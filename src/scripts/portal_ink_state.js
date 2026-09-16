const menu_values = new WeakMap();

export const ensure_portal_ink_values = (menu) => {
  let values = menu_values.get(menu);
  if (!values) {
    values = {
      resolution: [1, 1],
      center: [0.5, 0.5],
      extent: [0.5, 0.4],
      time: 0,
      reveal: 0,
      sdr: 1,
      scheme: 0,
    };
    menu_values.set(menu, values);
  }
  return values;
};
