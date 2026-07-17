export const requireConversionId = (id: string | undefined) => {
  if (!id) {
    throw new Error('Export did not start. Choose an output destination and try again.');
  }

  return id;
};
