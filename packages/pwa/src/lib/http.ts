export const safeJson = async (res: Response): Promise<unknown | null> => {
  try {
    return await res.json();
  } catch (error) {
    console.warn('Failed to parse JSON response:', error);
    return null;
  }
};

export const safeText = async (res: Response): Promise<string> => {
  try {
    return await res.text();
  } catch (error) {
    console.warn('Failed to read text response:', error);
    return '';
  }
};
