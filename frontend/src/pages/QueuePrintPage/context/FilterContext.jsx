import { createContext, useContext, useState } from 'react';

const FilterContext = createContext();

export const useFilters = () => useContext(FilterContext);

export const FilterProvider = ({ children }) => {
  const [selectedFilters, setSelectedFilters] = useState({});

  const updateFilter = (filterField, selectedValues) => {
    setSelectedFilters((prev) => ({
      ...prev,
      [filterField]: selectedValues,
    }));
  };

  return <FilterContext.Provider value={{ selectedFilters, updateFilter }}>{children}</FilterContext.Provider>;
};
