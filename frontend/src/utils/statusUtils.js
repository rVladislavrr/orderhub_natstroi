export const getStatusColor = (status) => {
  if (!status) return '#009ED8';

  const s = status.trim();

  switch (s) {
    case 'В работе':
      return '#3b82f6';

    case 'Новый':
      return '#009ED8';

    case 'Готов':
      return '#f59e0b';

    case 'Собран':
      return '#8b5cf6';

    case 'Завершен':
      return '#10b981';

    case 'Отгружен':
      return '#0f766e';

    case 'Отменен':
      return '#000000';

    default:
      console.warn('Неизвестный статус:', status);
      return '#009ED8';
  }
};
