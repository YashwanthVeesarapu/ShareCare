import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import axios from 'axios';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.scss',
})
export class UploadComponent {
  files: File[] = [];
  folderName: string = '';
  uploadProgress: number = 0;
  uploadSuccess: boolean = false;
  uploadError: string | null = null;
  failedFiles: string[] = []; // <-- Track failed files

  checking = false;
  needUploadPaths: string[] = [];
  alreadyExistsPaths: string[] = [];

  uploading = false;
  saved: string[] = [];
  skipped: string[] = [];

  private readonly CONCURRENCY = 4;
  private fileMap = new Map<string, File>();

  onFolderSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.files = Array.from(input.files);
      this.folderName = this.files[0]?.webkitRelativePath.split('/')[0] || '';

      // build/refresh map for retries
      this.fileMap.clear();
      for (const f of this.files) this.fileMap.set(this.relPath(f), f);

      // Reset previous state
      this.uploadSuccess = false;
      this.uploadError = null;
      this.uploadProgress = 0;
      this.failedFiles = []; // clear old failures when a new folder is chosen
    }
  }

  private relPath(f: File) {
    // browser supplies webkitRelativePath when selecting a folder
    return (f as any).webkitRelativePath || f.name;
  }

  // Compute overall % from per-file byte counters
  private computeOverallProgress(
    loaded: Map<string, number>,
    totals: Map<string, number>
  ) {
    let sumLoaded = 0,
      sumTotal = 0;
    for (const k of totals.keys()) {
      sumLoaded += loaded.get(k) || 0;
      sumTotal += totals.get(k) || 0;
    }
    return sumTotal
      ? Math.min(100, Math.round((sumLoaded * 100) / sumTotal))
      : 0;
  }

  // reusable concurrent batch uploader (filesToSend = subset or full set)
  private async uploadBatch(filesToSend: File[]) {
    const URL = `${environment.API_URL}/files`;
    const totals = new Map<string, number>();
    const loaded = new Map<string, number>();

    for (let i = 0; i < filesToSend.length; i += this.CONCURRENCY) {
      const batch = filesToSend.slice(i, i + this.CONCURRENCY);
      await Promise.allSettled(
        batch.map((f) => this.uploadOneFile(f, URL, totals, loaded))
      );
    }
  }

  // Upload a single file (1 POST per file)
  private async uploadOneFile(
    file: File,
    URL: string,
    totals: Map<string, number>,
    loaded: Map<string, number>
  ) {
    const path = this.relPath(file);
    const formData = new FormData();
    formData.append('files', file); // backend accepts list[UploadFile]; single works
    formData.append('folderName', this.folderName);

    // initialize totals with file.size so overall % is smooth even if evt.total is missing
    totals.set(path, file.size || 0);
    loaded.set(path, 0);

    try {
      const res = await axios.post(URL, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          const total = evt.total ?? file.size ?? 0;
          totals.set(path, total);
          loaded.set(path, evt.loaded || 0);
          this.uploadProgress = this.computeOverallProgress(loaded, totals);
        },
      });

      // Merge results (backend returns arrays even for single file)
      const saved = res.data?.saved ?? [];
      const skipped = res.data?.skipped ?? [];
      this.saved.push(...saved);
      this.skipped.push(...skipped);

      // if this was a retry and it succeeded, remove from failed list
      const idx = this.failedFiles.indexOf(path);
      if (idx > -1) this.failedFiles.splice(idx, 1);
    } catch {
      if (!this.failedFiles.includes(path)) this.failedFiles.push(path);
    }
  }

  async checkExisting() {
    if (!this.files.length) return;
    this.checking = true;
    this.uploadError = null;
    const URL = `${environment.API_URL}/files/check`;

    try {
      const paths = this.files.map((f) => this.relPath(f));
      const { data } = await axios.post(URL, { paths });
      this.needUploadPaths = data?.need_upload ?? [];
      this.alreadyExistsPaths = data?.already_exists ?? [];
      this.checking = false;
    } catch {
      this.uploadError = 'Pre-check failed. Please try again.';
    } finally {
      this.checking = false;
    }
  }

  clearFilesAndInput() {
    this.files = [];
    const inputElement = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    if (inputElement) {
      inputElement.value = ''; // Clear the file input
    }
  }

  async uploadFiles(mode: 'needed' | 'all' = 'needed') {
    if (!this.files.length) return;

    // ensure we know what’s needed
    if (mode === 'needed') {
      await this.checkExisting();
      if (this.needUploadPaths.length === 0) {
        this.uploadSuccess = true;
        return;
      }
    }

    const filesToSend =
      mode === 'all'
        ? this.files
        : this.files.filter((f) =>
            this.needUploadPaths.includes(this.relPath(f))
          );

    if (!filesToSend.length) {
      this.uploadSuccess = true;
      return;
    }

    // reset UI state for a fresh upload
    this.uploading = true;
    this.uploadProgress = 0;
    this.uploadSuccess = false;
    this.uploadError = null;
    this.saved = [];
    this.skipped = [];
    this.failedFiles = []; // fresh run

    try {
      await this.uploadBatch(filesToSend);
      this.uploadProgress = 100;
      this.uploading = false;

      if (this.failedFiles.length) {
        this.uploadError = 'Some files failed to upload.';
      } else {
        this.uploadSuccess = true;
      }
    } catch {
      this.uploading = false;
      this.uploadError = 'Upload failed. Please try again.';
    }
  }

  // ⭐ NEW: retry only the failed files
  async retryFailedFiles() {
    if (!this.failedFiles.length) return;

    // Rehydrate File objects from paths
    const filesToRetry: File[] = [];
    for (const p of this.failedFiles) {
      const f = this.fileMap.get(p);
      if (f) filesToRetry.push(f);
    }
    if (!filesToRetry.length) return;

    // prepare UI for a retry pass
    this.uploading = true;
    this.uploadProgress = 0;
    this.uploadError = null;
    // keep existing this.saved / this.skipped; we’re just filling in the gaps

    try {
      await this.uploadBatch(filesToRetry);
      this.uploadProgress = 100;
      this.uploading = false;

      if (this.failedFiles.length) {
        this.uploadError = 'Some files still failed on retry.';
      } else {
        this.uploadSuccess = true;
      }
    } catch {
      this.uploading = false;
      this.uploadError = 'Retry failed. Please try again.';
    }
  }

  // async uploadFiles(mode: 'needed' | 'all' = 'needed') {
  //   if (!this.files.length) return;

  //   // only proceed after a check so the counts/buttons make sense
  //   if (!this.checking && mode === 'needed') {
  //     await this.checkExisting();
  //     if (this.needUploadPaths.length === 0) {
  //       this.uploadSuccess = true;
  //       return;
  //     }
  //   }

  //   const toSend =
  //     mode === 'all'
  //       ? this.files
  //       : this.files.filter((f) =>
  //           this.needUploadPaths.includes(this.relPath(f))
  //         );

  //   if (!toSend.length && mode === 'needed') {
  //     this.uploadSuccess = true; // everything already on server
  //     setTimeout(() => (this.uploadSuccess = false), 2500);
  //     return;
  //   }

  //   const URL = `${environment.API_URL}/files`;
  //   const formData = new FormData();
  //   toSend.forEach((f) => formData.append('files', f));
  //   formData.append('folderName', this.folderName);

  //   // Reset status
  //   this.uploading = true;
  //   this.uploadProgress = 0;
  //   this.uploadSuccess = false;
  //   this.uploadError = null;
  //   this.saved = [];
  //   this.skipped = [];

  //   try {
  //     const response = await axios.post(URL, formData, {
  //       headers: { 'Content-Type': 'multipart/form-data' },
  //       onUploadProgress: (evt) => {
  //         if (evt.total) {
  //           this.uploadProgress = Math.round((evt.loaded * 100) / evt.total);
  //         }
  //       },
  //     });

  //     // existing backend returns { message, saved, skipped }
  //     this.saved = response.data?.saved ?? [];
  //     this.skipped = response.data?.skipped ?? [];

  //     this.uploadSuccess = true;

  //     setTimeout(() => (this.uploadSuccess = false), 3000);
  //   } catch (error) {
  //     this.uploadError = 'Upload failed. Please try again.';
  //   }
  // }
}
