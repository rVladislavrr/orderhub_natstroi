export const getStatusColor = (status) => {
  switch (status) {
    case 'В разработке':
      return '#004e8d';
    case 'Новый':
      return '#009ED8';
    case 'Отменен':
      return '#000000';
    case 'Завершен':
      return '#A3ABB2';
    default:
      return '#009ED8';
  }
};
