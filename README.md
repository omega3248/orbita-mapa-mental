# Órbita · Mapa mental interactivo

Un mapa mental espacial para ordenar ideas de forma más natural, visual e interactiva. En lugar de una lista fija, las ideas ocupan cuadros con profundidad que puedes mover, agrupar, priorizar y conectar dentro de un espacio cartesiano tridimensional.

## Qué puedes hacer

- Crear, editar y eliminar ideas, becas u oportunidades.
- Arrastrar cuadros por el espacio y ajustar ancho, largo y alto.
- Mover la vista, girar la perspectiva y hacer zoom hacia el puntero.
- Seleccionar varios cuadros con **Ctrl + clic** y conectarlos.
- Personalizar la forma, el tipo, el color, el grosor y la dirección de las líneas.
- Marcar un **cuadro central** para dirigir sus flechas hacia las demás ideas.
- Cambiar colores de planos, sectores y cuadros con una rueda y cinco muestras.
- Organizar por importancia, filtrar categorías y alternar entre mapa y lista.
- Deshacer cambios y exportar o importar una copia del mapa en JSON.

## Uso local

Aplicación estática escrita con HTML, CSS y JavaScript, sin dependencias de compilación. Desde la raíz del repositorio:

```sh
python -m http.server 8080 --directory dist
```

Abre `http://localhost:8080` en el navegador.

**Controles:** clic izquierdo para seleccionar; Ctrl + clic para selección múltiple; clic derecho sostenido para mover cuadros; arrastre con el izquierdo para mover la vista; rueda para acercar o alejar hacia el puntero. El modo de giro o Alt + arrastre izquierdo cambia la perspectiva.

## Guardado y ejemplo inicial

El mapa se guarda en el navegador mediante `localStorage`. Exporta una copia JSON para conservarlo o llevarlo a otro dispositivo. Los datos personales que cada visitante escriba en el mapa permanecen en su navegador y no se suben al repositorio.

La demostración incluye becas, cursos y programas de emprendimiento como ejemplo de organización. Sus fechas y condiciones son referencias por verificar en las fuentes oficiales; pueden editarse o sustituirse por otras ideas.

## Archivos principales

- `dist/index.html` y `dist/style.css`: interfaz y diseño adaptable.
- `dist/app.js`: mapa, selección, controles, persistencia y edición.
- `dist/scene-math.js`: proyección espacial, cámara y dimensiones.
- `dist/connection-utils.js`: conexiones y flechas.
- `dist/color-utils.js` y `dist/palette.js`: color y paleta interactiva.
- `dist/data.js`: ideas y relaciones del ejemplo inicial.

Desarrollado como proyecto personal de Julián Ortiz.
