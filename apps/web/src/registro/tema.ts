import { createTheme } from '@mui/material/styles';

/** Paleta del diseño «Registro Simple» (Claude Design). */
export const colores = {
  rojo: '#D62839',
  rojoOscuro: '#b20024',
  rojoSuave: '#FDE8EA',
  verde: '#2E7D32',
  verdeOscuro: '#11651d',
  verdeSuave: '#E6F4E7',
  amarillo: '#F6D47E',
  amarilloSuave: '#FDF4DC',
  amarilloTinta: '#745b10',
  crema: '#FFF9F2',
  cremaRosa: '#FFF1EA',
  borde: '#EFE4D8',
  texto: '#3A2414',
  textoSuave: '#6B5A4E',
  lienzo: '#f0eee9',
  camara: '#1f150e',
} as const;

export const tema = createTheme({
  palette: {
    primary: { main: colores.rojo, dark: colores.rojoOscuro, contrastText: '#fff' },
    success: { main: colores.verde, dark: colores.verdeOscuro, contrastText: '#fff' },
    background: { default: colores.crema, paper: '#fff' },
    text: { primary: colores.texto, secondary: colores.textoSuave },
    divider: colores.borde,
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: "'Nunito Sans', system-ui, sans-serif",
    h1: { fontSize: 26, lineHeight: '32px', fontWeight: 800 },
    h2: { fontSize: 14, fontWeight: 800, letterSpacing: '.06em' },
    body1: { fontSize: 17, lineHeight: '26px' },
    body2: { fontSize: 16, fontWeight: 600 },
    caption: { fontSize: 14, fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 800 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 999, minHeight: 60, fontSize: 19 },
        text: { minHeight: 48, fontSize: 16, fontWeight: 700 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { height: 40, borderRadius: 999, fontSize: 15, fontWeight: 700 },
      },
    },
    // ButtonBase es un <button>: sin esto no hereda Nunito Sans.
    MuiButtonBase: { styleOverrides: { root: { fontFamily: 'inherit' } } },
    MuiAvatar: { styleOverrides: { root: { fontWeight: 800 } } },
  },
});
