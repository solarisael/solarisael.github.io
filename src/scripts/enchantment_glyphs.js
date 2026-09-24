export const RUNIC_GLYPHS = [..."ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛈᛇᛉᛋᛏᛒᛖᛗᛚᛜᛟᛞ"];
export const SYMBOL_GLYPHS = [..."☽☿♀♂♃♄♁♆♇⚹⚺⚻⚼🜁🜂🜃🜄🜍🜔🜚🜛"];

export const load_enchantment_fonts = async () => {
  const faces = await Promise.all([
    document.fonts.load('16px "Solarisael Runic"', RUNIC_GLYPHS.join("")),
    document.fonts.load('16px "Solarisael Symbols"', SYMBOL_GLYPHS.join("")),
  ]);
  await document.fonts.ready;
  if (faces.some((family) => family.length === 0)) {
    throw new Error("The enchanted alphabet requires its bundled fonts.");
  }
};
