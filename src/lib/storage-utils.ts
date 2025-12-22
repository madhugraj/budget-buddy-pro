// Storage utility to handle migration from old Lovable storage to new Supabase
// Files that don't exist in new storage will fall back to old URLs

const OLD_STORAGE_URL = "https://ujnxljbaapuvpnjdkick.supabase.co/storage/v1/object/public";

/**
 * Get the download URL for a file, falling back to old storage if needed
 */
export async function getStorageUrl(
    supabase: any,
    bucket: string,
    path: string
): Promise<string> {
    // If it's already a full URL, return it
    if (path?.startsWith('http')) {
        return path;
    }

    try {
        // Try to get signed URL from new storage
        const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, 3600);

        if (!error && data?.signedUrl) {
            return data.signedUrl;
        }

        // If file doesn't exist in new storage, try old storage
        console.log(`File not in new storage, trying old: ${bucket}/${path}`);

        // Check if file exists in old storage
        const oldUrl = `${OLD_STORAGE_URL}/${bucket}/${path}`;
        const response = await fetch(oldUrl, { method: 'HEAD' });

        if (response.ok) {
            return oldUrl;
        }

        throw new Error('File not found in either storage');
    } catch (error) {
        console.error('Error getting storage URL:', error);
        throw error;
    }
}

/**
 * Upload a file to storage (always goes to new Supabase)
 */
export async function uploadToStorage(
    supabase: any,
    bucket: string,
    path: string,
    file: File
): Promise<{ error: any; data?: any }> {
    return await supabase.storage.from(bucket).upload(path, file);
}
