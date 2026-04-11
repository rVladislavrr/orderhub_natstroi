import './ColumnsSelector.css';

const ColumnsSelector = () => {
  const columns = ['Номер детали', 'Тип', 'Размер', 'Длина', 'Ширина', 'Вес', 'Марка стали', 'Операция', 'Марка', 'Наименование марки', 'Кол-во', 'Очередь', 'Вес позиции'];

  return (
    <div className="columns-section">
      <h3>Настройка колонок</h3>
      <div className="columns-grid">
        {columns.map((column, index) => (
          <label key={index}>
            <input type="checkbox" /> {column}
          </label>
        ))}
      </div>
    </div>
  );
};

export default ColumnsSelector;
