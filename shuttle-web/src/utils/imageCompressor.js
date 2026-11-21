/**
 * 클라이언트 측 이미지 리사이징 & 압축 유틸리티
 * 원본 대용량 사진(수 MB)을 업로드 전 최대 해상도 1600px, 80% JPEG 품질로 최적화하여
 * 네트워크 전송 속도 및 서버 저장 공간을 90% 이상 절감합니다.
 */
export async function compressImage(file, maxWidth = 1600, quality = 0.8) {
  if (!file || !file.type.startsWith('image/')) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ base64Data: reader.result, filename: file.name, mimeType: file.type });
      reader.readAsDataURL(file);
    });
  }

  // GIF 애니메이션이거나 이미 300KB 이하의 경량 파일이면 원본 유지
  if (file.type === 'image/gif' || file.size < 300 * 1024) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ base64Data: reader.result, filename: file.name, mimeType: file.type });
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = 'image/jpeg';
        const base64Data = canvas.toDataURL(mimeType, quality);
        resolve({
          base64Data,
          filename: file.name.replace(/\.[^/.]+$/, '.jpg'),
          mimeType,
        });
      };
      img.onerror = () => {
        resolve({ base64Data: e.target.result, filename: file.name, mimeType: file.type });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
