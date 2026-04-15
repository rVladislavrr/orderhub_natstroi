import { api } from './ordersApi';

export const getDynamicFilterOptions = async (field, kmdUuids = [], filters = {}, kmdList = []) => {
  try {
    console.log(filters);
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
        graphqlFilters[toCamelCase(key)] = filters[key];
      }
    });

    const filtersString =
      Object.keys(graphqlFilters).length > 0
        ? `filters: {${Object.entries(graphqlFilters)
            .map(([k, v]) => (Array.isArray(v) ? `${k}: [${v.map((val) => `"${val}"`).join(', ')}]` : `${k}: "${v}"`))
            .join(', ')}}`
        : '';

    const kmdUuidsString = finalKmdUuids.length > 0 ? `kmdUuids: [${finalKmdUuids.map((uuid) => `"${uuid}"`).join(', ')}]` : 'kmdUuids: []';

    delete graphqlFilters.kmdNum;
    delete graphqlFilters.kmd_num;

    const query = `
      query GetFilterOptions {
        dynamicHierarchy(
          groupBy: {field: "${field}", order: 1}
          ${kmdUuidsString}
          ${filtersString}
        ) {
          nodes {
            value
            totalQuantity
          }
        }
      }
    `;

    const response = await api.post('/graphql', { query });
    return response.data?.data?.dynamicHierarchy.nodes || [];
  } catch (error) {
    console.error(`GraphQL error for field ${field}:`, error);
    return [];
  }
};

export const getDynamicHierarchy = async ({ groupBy = [], kmdUuids = [], filters = {}, isNumDetailVisible = true }) => {
  const graphqlFilters = {};
  try {
    const groupByString = groupBy.map((g) => `{ field: "${g.field}", order: ${g.order} }`).join(', ');

    const kmdUuidsString = kmdUuids.length > 0 ? `kmdUuids: [${kmdUuids.map((id) => `"${id}"`).join(', ')}]` : 'kmdUuids: []';

    Object.keys(filters).forEach((key) => {
      if (filters[key] && filters[key].length > 0) {
        if (key === 'kmd_num') {
          return;
        }

        const toCamelCase = (str) => str.replace(/_./g, (match) => match[1].toUpperCase());
        graphqlFilters[toCamelCase(key)] = filters[key];
      }
    });

    const filtersString =
      Object.keys(graphqlFilters).length > 0
        ? `filters: {${Object.entries(graphqlFilters)
            .map(([k, v]) => (Array.isArray(v) ? `${k}: [${v.map((val) => `"${val}"`).join(', ')}]` : `${k}: "${v}"`))
            .join(', ')}}`
        : '';

    const weightField = isNumDetailVisible ? 'totalWeight' : 'totalMarkWeight';

    const buildChildrenQuery = (depth, maxDepth) => {
      if (depth >= maxDepth) return '';
      return `
        children {
          level
          value
          ${weightField}
          ${buildChildrenQuery(depth + 1, maxDepth)}
        }
      `;
    };

    const maxDepth = groupBy.length;
    const childrenQuery = buildChildrenQuery(1, maxDepth);

    const query = `
      query GetDynamicHierarchy {
        dynamicHierarchy(
          groupBy: [${groupByString}]
          ${kmdUuidsString}
          ${filtersString}
        ) {
          nodes {
            level
            value
            ${weightField}
            ${childrenQuery}
          }
            statistics {
            totalWeight
            totalQuantity
            }
        }
      }
    `;

    const response = await api.post('/graphql', { query });
    console.log('kmdUuids:', kmdUuids);
    return response.data?.data?.dynamicHierarchy || [];
  } catch (error) {
    console.error('GraphQL dynamicHierarchy error:', error);
    return [];
  }
};
