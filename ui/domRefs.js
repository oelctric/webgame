window.createDomRefs = function createDomRefs(ids) {
  const refs = {};
  Object.entries(ids).forEach(([key, id]) => {
    refs[key] = document.getElementById(id);
  });
  return refs;
};
