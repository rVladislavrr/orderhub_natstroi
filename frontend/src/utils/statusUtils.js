export const getStatusColor = (status) => {
  if (!status) return '#009ED8';

  const s = status.trim();

  switch (s) {
    case 'В работе':
      return '#3b82f6';

    case 'Новый':
      return '#009ED8';

    case 'Отменен':
      return '#000000';

    case 'Завершен':
      return '#10b981';

    default:
      console.warn('Неизвестный статус детали:', status);
      return '#009ED8';
  }
};
