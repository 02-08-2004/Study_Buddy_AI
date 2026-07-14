const axios = require('axios');

const CLASSROOM_BASE = 'https://classroom.googleapis.com/v1';
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';

class GoogleClassroomService {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.headers = { Authorization: `Bearer ${accessToken}` };
  }

  async getCourses() {
    try {
      const response = await axios.get(`${CLASSROOM_BASE}/courses`, {
        headers: this.headers,
        params: { courseStates: 'ACTIVE', pageSize: 50 }
      });
      return response.data.courses || [];
    } catch (err) {
      this._handleError(err, 'fetching courses');
    }
  }

  async getCourseWork(courseId) {
    try {
      const response = await axios.get(
        `${CLASSROOM_BASE}/courses/${courseId}/courseWorkMaterials`,
        { headers: this.headers, params: { pageSize: 100 } }
      );
      return response.data.courseWorkMaterial || [];
    } catch (err) {
      // Materials endpoint might not be available; return empty
      return [];
    }
  }

  async getCourseAnnouncements(courseId) {
    try {
      const response = await axios.get(
        `${CLASSROOM_BASE}/courses/${courseId}/announcements`,
        { headers: this.headers, params: { pageSize: 50 } }
      );
      return response.data.announcements || [];
    } catch (err) {
      return [];
    }
  }

  async getCourseWork2(courseId) {
    try {
      const response = await axios.get(
        `${CLASSROOM_BASE}/courses/${courseId}/courseWork`,
        { headers: this.headers, params: { pageSize: 100 } }
      );
      return response.data.courseWork || [];
    } catch (err) {
      return [];
    }
  }

  async getCourseDriveFiles(folderId) {
    if (!folderId) return [];
    try {
      const response = await axios.get(`${DRIVE_BASE}/files`, {
        headers: this.headers,
        params: {
          q: `'${folderId}' in parents and trashed = false`,
          fields: 'files(id, name, mimeType, webViewLink)',
          pageSize: 100
        }
      });
      return response.data.files || [];
    } catch (err) {
      console.error('Drive fetch error:', err.message);
      return [];
    }
  }

  async getDriveFile(fileId) {
    try {
      const response = await axios.get(`${DRIVE_BASE}/files/${fileId}`, {
        headers: this.headers,
        params: { fields: 'id,name,mimeType,size,modifiedTime,webViewLink' }
      });
      return response.data;
    } catch (err) {
      this._handleError(err, `fetching Drive file ${fileId}`);
    }
  }

  async downloadDriveFile(fileId, mimeType) {
    try {
      let url;
      let params = {};

      // Google Docs/Slides/Sheets need export
      const exportMap = {
        'application/vnd.google-apps.document': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.google-apps.presentation': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.google-apps.spreadsheet': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };

      if (exportMap[mimeType]) {
        url = `${DRIVE_BASE}/files/${fileId}/export`;
        params.mimeType = exportMap[mimeType];
      } else {
        url = `${DRIVE_BASE}/files/${fileId}?alt=media`;
      }

      const response = await axios.get(url, {
        headers: this.headers,
        params,
        responseType: 'arraybuffer'
      });

      return Buffer.from(response.data);
    } catch (err) {
      this._handleError(err, `downloading file ${fileId}`);
    }
  }

  _handleError(err, context) {
    const status = err.response?.status;
    const message = err.response?.data?.error?.message || err.message;

    if (status === 401) {
      throw new Error('Google access token expired. Please re-authenticate.');
    }
    if (status === 403) {
      throw new Error(`Permission denied while ${context}. Check your OAuth scopes.`);
    }
    console.error(`Google API error (${context}):`, message);
    throw new Error(`Failed ${context}: ${message}`);
  }
}

// Extract all drive file attachments from classroom materials
const extractMaterialFiles = (materials) => {
  const files = [];

  for (const material of materials) {
    const attachments = material.materials || [];

    for (const attachment of attachments) {
      if (attachment.driveFile) {
        const df = attachment.driveFile.driveFile || attachment.driveFile;
        files.push({
          classroom_material_id: material.id,
          drive_file_id: df.id,
          file_name: df.title || df.name || 'Untitled',
          file_type: 'drive',
          material_title: material.title || 'Untitled Material'
        });
      } else if (attachment.link) {
        files.push({
          classroom_material_id: material.id,
          drive_file_id: null,
          file_url: attachment.link.url,
          file_name: attachment.link.title || attachment.link.url,
          file_type: 'link',
          material_title: material.title || 'Untitled Material'
        });
      } else if (attachment.youtubeVideo) {
        files.push({
          classroom_material_id: material.id,
          drive_file_id: null,
          file_url: attachment.youtubeVideo.alternateLink,
          file_name: attachment.youtubeVideo.title || 'YouTube Video',
          file_type: 'youtube',
          material_title: material.title || 'Untitled Material'
        });
      }
    }
  }

  return files;
};

module.exports = { GoogleClassroomService, extractMaterialFiles };
