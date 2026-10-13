function responseDifferences(before, after, path = '$') {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (before && after && typeof before === 'object' && typeof after === 'object') {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(key => responseDifferences(before[key], after[key], `${path}[${JSON.stringify(key)}]`));
  }
  return [{ path, before, after }];
}
