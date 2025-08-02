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

  onFolderSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.files = Array.from(input.files);
      this.folderName = this.files[0]?.webkitRelativePath.split('/')[0] || '';

      // Reset previous state
      this.uploadSuccess = false;
      this.uploadError = null;
      this.failedFiles = [];
      this.uploadProgress = 0;
    }
  }

  async uploadFiles() {
    if (!this.files.length) return;

    const URL = `${environment.API_URL}/files`;
    const formData = new FormData();
    this.files.forEach((file) => formData.append('files', file));
    formData.append('folderName', this.folderName);

    // Reset status
    this.uploadProgress = 0;
    this.uploadSuccess = false;
    this.uploadError = null;
    this.failedFiles = [];

    try {
      const response = await axios.post(URL, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            this.uploadProgress = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
          }
        },
      });

      // Assume backend returns { success: true, failedFiles: [] }
      if (response.data.failedFiles && response.data.failedFiles.length > 0) {
        this.failedFiles = response.data.failedFiles;
        this.uploadError = 'Some files failed to upload.';
      } else {
        this.uploadSuccess = true;
      }

      // Auto-hide success message after 3s
      if (this.uploadSuccess) {
        setTimeout(() => (this.uploadSuccess = false), 3000);
      }
    } catch (error) {
      this.uploadError = 'Upload failed. Please try again.';
    }
  }
}
