import { functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';

/**
 * Upload image file to ImgBB via Cloud Function
 * @param {File} file - The image file to upload
 * @returns {Promise<string|null>} - The uploaded image URL or null if failed
 */
export const uploadImageSecurely = async (file) => {
    if (!file) return null;

    try {
        // Convert file to base64
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
            reader.onloadend = () => {
                const base64String = reader.result.split(',')[1]; // Remove data:image/...;base64, prefix
                resolve(base64String);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        const base64Image = await base64Promise;

        
        const uploadImageFn = httpsCallable(functions, 'uploadImage');
        const result = await uploadImageFn({ base64Image });

        if (result.data.success) {
            return result.data.url;
        } else {
            alert('Upload failed. Please try again.');
            return null;
        }
    } catch (error) {
        console.error("Error uploading image:", error);
        alert("Error uploading image. Please try again.");
        return null;
    }
};
