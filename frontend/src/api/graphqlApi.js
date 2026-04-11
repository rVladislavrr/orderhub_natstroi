import { api } from './ordersApi';

export const getDynamicFilterOptions = async (field, kmdUuids = [], filters = {}, kmdList = []) => {
  try {
    const graphqlFilters = {};

    const kmdMap = {};
    kmdList.forEach((kmd) => {
      kmdMap[kmd.num_kmd] = kmd.uuid;
    });

    let finalKmdUuids = [...kmdUuids];

    Object.keys(filters).forEach((key) => {
      if (filters[key] && filters[key].length > 0) {
        if (key === 'kmd_num') {
          const selectedNumKmd = filters[key][0];
          const foundUuid = kmdMap[selectedNumKmd];
          if (foundUuid) {
            finalKmdUuids = [foundUuid];
          }
          return;
        }

        const toCamelCase = (str) => str.replace(/_./g, (match) => match[1].toUpperCase());
        graphqlFilters[toCamelCase(key)] = filters[key][0];
      }
    });

    const filtersString =
      Object.keys(graphqlFilters).length > 0
        ? `filters: {${Object.entries(graphqlFilters)
            .map(([k, v]) => `${k}: "${v}"`)
            .join(', ')}}`
        : '';

    const kmdUuidsString = finalKmdUuids.length > 0 ? `kmdUuids: [${finalKmdUuids.map((uuid) => `"${uuid}"`).join(', ')}]` : 'kmdUuids: []';

    const query = `
      query GetFilterOptions {
        dynamicHierarchy(
          groupBy: {field: "${field}", order: 1}
          ${kmdUuidsString}
          ${filtersString}
        ) {
          value
          totalQuantity
        }
      }
    `;

    const response = await api.post('/graphql', { query });
    return response.data?.data?.dynamicHierarchy || [];
  } catch (error) {
    console.error(`GraphQL error for field ${field}:`, error);
    return [];
  }
};
