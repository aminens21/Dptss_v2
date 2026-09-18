/**
 * Utility functions for compressing images into ultra-lightweight Base64 thumbnails
 * to ensure optimal performance, minimal storage footprint, and instant caching.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0
}

export const compressImageToBase64 = (
  input: File | string,
  options: CompressionOptions = {}
): Promise<string> => {
  const { maxWidth = 200, maxHeight = 200, quality = 0.7 } = options;

  return new Promise((resolve, reject) => {
    const processDataUrl = (dataUrl: string) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          // Compute aspect-ratio preserved dimensions
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          // Ensure minimum valid dimensions
          width = Math.max(1, width);
          height = Math.max(1, height);

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }

          // Smooth rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'medium';
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to compressed JPEG data URL
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        } catch (e) {
          console.warn('Image compression fallback to original:', e);
          resolve(dataUrl);
        }
      };

      img.onerror = () => {
        // Fallback to input string if parsing fails
        resolve(dataUrl);
      };

      img.src = dataUrl;
    };

    if (typeof input === 'string') {
      processDataUrl(input);
    } else if (typeof Blob !== 'undefined' && input instanceof Blob) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          processDataUrl(result);
        } else {
          reject(new Error('Failed to read image file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(input);
    } else {
      reject(new Error('Invalid image input'));
    }
  });
};

/**
 * Returns the size of a Base64 string in Kilobytes (KB)
 */
export const getBase64SizeInKB = (base64: string): number => {
  if (!base64) return 0;
  const cleanBase64 = base64.replace(/^data:image\/[a-z]+;base64,/, '');
  const sizeInBytes = Math.round((cleanBase64.length * 3) / 4);
  return Math.round((sizeInBytes / 1024) * 10) / 10;
};

/**
 * Returns human-readable size text (e.g., "5.4 KB")
 */
export const formatBase64Size = (base64: string): string => {
  const size = getBase64SizeInKB(base64);
  return `${size} كيلوبايت`;
};
