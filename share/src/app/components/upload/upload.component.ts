import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

import axios, { AxiosProgressEvent } from 'axios';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-upload',
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

  onFolderSelected(event: Event) {
    const input = event.target as HTMLInputElement;

    if (input.files) {
      this.folderName = input.files[0].webkitRelativePath.split('/')[0];
      for (let i = 0; i < input.files.length; i++) {
        this.files.push(input.files[i]);
      }
    }
  }

  uploadFiles() {
    const URL = `${environment.API_URL}/files`;
    const formData = new FormData();
    this.files.forEach((file) => {
      formData.append('files', file);
    });
    formData.append('folderName', this.folderName);
    this.uploadProgress = 0;
    this.uploadSuccess = false;
    this.uploadError = null;
    axios
      .post(URL, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent: any) => {
          this.uploadProgress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
        },
      })
      .then((response) => {
        this.uploadSuccess = true;
        console.log('Upload successful:', response.data);
      })
      .catch((error) => {
        this.uploadError = 'Upload failed. Please try again.';
        console.error('Upload error:', error);
      });
  }
}
