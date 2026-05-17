export function calculateProgress(uomType: string, target: string, actual: string | null): number {
  if (!actual || actual.trim() === '') return 0;
  
  const targetNum = Number(target);
  const actualNum = Number(actual);

  if (isNaN(targetNum) || isNaN(actualNum) && uomType !== 'TIMELINE') {
    return 0; // fallback
  }

  switch (uomType) {
    case 'NUMERIC':
    case 'PERCENTAGE':
      // Assuming Min strategy by default (higher is better)
      if (targetNum === 0) return 0;
      return Math.min((actualNum / targetNum) * 100, 100);
      
    case 'ZERO_BASED':
      return actualNum === 0 ? 100 : 0;
      
    case 'TIMELINE':
      // Simple date comparison for demo purposes
      const targetDate = new Date(target).getTime();
      const actualDate = new Date(actual).getTime();
      if (isNaN(targetDate) || isNaN(actualDate)) return 0;
      return actualDate <= targetDate ? 100 : 0;
      
    default:
      return 0;
  }
}
