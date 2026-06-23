const SUPPORTED_AUDIO_EXTENSIONS = [".mp3", ".m4a", ".wav"];

export function isSupportedAudioFile(filename: string) {
  const normalizedName = filename.toLowerCase();
  return SUPPORTED_AUDIO_EXTENSIONS.some((extension) => normalizedName.endsWith(extension));
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Number((bytes / 1024).toFixed(1))} KB`;
  }

  return `${Number((bytes / (1024 * 1024)).toFixed(1))} MB`;
}
