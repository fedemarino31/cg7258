# Prompt para Codex: migrar menú de límites a Tweakpane + Essentials con sliders de rango min/max

Quiero que reimplementes el menú de control actual de esta aplicación reemplazando la parte correspondiente a los **límites de color** para usar **Tweakpane** junto con su plugin **Essentials**, de manera que los pares **mínimo / máximo** de una misma variable se representen como **un único control de rango** con dos handles, en lugar de dos sliders separados.

## Objetivo funcional

Actualmente, en el menú, cada componente del modelo de color aparece con controles separados del tipo:

- `H Min` y `H Max`
- `S Min` y `S Max`
- `V Min` y `V Max`
- `R Min` y `R Max`
- etc.

Quiero que, cuando existan dos propiedades que representen el **mínimo y el máximo de una misma variable**, se unifiquen en **un solo slider de rango** para que:

- el usuario vea un único control por variable,
- pueda ajustar el intervalo completo de forma más intuitiva,
- el valor mínimo **nunca pueda superar** al máximo,
- y el máximo **nunca pueda quedar por debajo** del mínimo.

## Modelos de color involucrados

Esto debe aplicarse en todos los modelos de color que existan en la app, particularmente:

- `HSV`
- `RGB`
- `CMI`
- `HCL`

Y en general a cualquier modelo que siga la misma lógica de pares `Min` / `Max` para una misma componente.

Por ejemplo:

- En `HSV`: `H`, `S`, `V`
- En `RGB`: `R`, `G`, `B`
- En `CMI`: `C`, `M`, `I`
- En `HCL`: `H`, `C`, `L`

Si internamente los nombres exactos cambian, adaptalo al naming real del proyecto, pero mantené esta misma idea.

## Requisito de UI

En lugar de mostrar dos entradas independientes para cada componente, quiero algo conceptualmente así:

- `H: [min ----- max]`
- `S: [min ----- max]`
- `V: [min ----- max]`

Es decir, **un solo control por componente**, usando el tipo de binding / input de intervalo de **Tweakpane Essentials**.

## Importante

No quiero un parche superficial. Quiero una **reimplementación prolija del menú** en esta parte, usando Tweakpane como base de estos controles, no mantener la estructura vieja y apenas simular la unión.

## Qué tenés que resolver

Como vos conocés el código del proyecto, resolvé técnicamente:

1. **Dónde se construye actualmente el menú** y cómo está organizada la lógica de secciones / folders / bindings.
2. **Cómo migrar esa parte a Tweakpane** sin romper el resto del comportamiento de la app.
3. **Cómo mapear las propiedades existentes** del estado/configuración actual hacia una representación de intervalo del tipo:
   - `{ min: ..., max: ... }`
   o equivalente.
4. **Cómo sincronizar ida y vuelta** entre:
   - el estado interno existente de la app,
   - y los nuevos controles de Tweakpane.
5. **Cómo mantener compatibilidad funcional** con la lógica que ya consume esos límites de color.

## Requisitos de implementación

### 1. Unificar pares min/max de una misma componente

Detectá en la estructura actual del menú todos los casos donde haya propiedades equivalentes a:

- `hMin` / `hMax`
- `sMin` / `sMax`
- `vMin` / `vMax`
- `rMin` / `rMax`
- etc.

Y reemplazalos por un solo control de intervalo por componente.

### 2. Mantener los rangos correctos de cada modelo

Cada componente debe seguir respetando sus límites naturales actuales.

Ejemplos típicos:

- Hue: `0..360` o el rango que use realmente la app
- Saturación / valor / luminosidad: `0..1` o `0..100` o `0..255`, según cómo esté implementado el proyecto
- RGB: el rango real usado actualmente

No cambies arbitrariamente la semántica interna. Adaptá el control a la escala real del proyecto.

### 3. Preservar nombres claros en el panel

En el panel no quiero dos filas `Min` / `Max` para la misma variable. Quiero una sola fila por componente.

Ejemplo:

- `H`
- `S`
- `V`

Y que ese control ya represente el rango.

### 4. Sincronización robusta

Al mover cualquiera de los handles del intervalo:

- deben actualizarse correctamente las propiedades internas correspondientes,
- deben dispararse los mismos side effects necesarios que hoy disparan los controles existentes,
- y no deben generarse inconsistencias visuales ni numéricas.

### 5. Reset de límites

El comando actual tipo `Reset Límites` debe seguir funcionando correctamente con la nueva estructura.

Eso implica que, al resetear:

- todos los intervalos vuelvan a sus valores por defecto,
- el panel se refresque correctamente,
- y el estado interno quede consistente.

### 6. Cambio entre modelos de color

Cuando el usuario cambie el modelo de color (`HSV`, `RGB`, `CMI`, `HCL`):

- el panel debe reconstruir o actualizar los controles para mostrar las componentes correctas del modelo seleccionado,
- siempre usando sliders de rango para los pares min/max,
- sin dejar bindings viejos colgados,
- y evitando fugas de listeners o controles duplicados.

### 7. Diseño y estética

Tomá como referencia visual el menú actual: simple, compacto, oscuro, técnico.

No hace falta copiarlo pixel por pixel, pero sí mantener:

- una apariencia sobria,
- jerarquía clara por secciones,
- labels cortos,
- y una interacción más limpia que la actual.

## Alcance esperado

Quiero que implementes:

- la migración de la sección de límites a Tweakpane + Essentials,
- la adaptación del modelo de datos necesario,
- la reconstrucción dinámica según el modelo de color,
- y la preservación de la funcionalidad existente.

## Entregable esperado

Hacé los cambios directamente en el proyecto.

Además, dejá el código lo suficientemente limpio como para que en el futuro sea fácil agregar nuevos modelos de color o nuevas componentes que también tengan pares `Min` / `Max`.

## Criterio de éxito

Considero que está bien resuelto si:

1. ya no existen sliders separados `Min` y `Max` para una misma componente,
2. cada componente se controla con un único slider de rango,
3. el mínimo no puede sobrepasar al máximo,
4. cambiar de modelo de color actualiza correctamente el panel,
5. resetear límites funciona,
6. y toda la lógica previa de filtrado/visualización sigue respondiendo correctamente a los nuevos controles.

## Nota

No te quedes atado a la estructura vieja del menú si complica la solución. Si para resolverlo bien conviene refactorizar la construcción de la UI de límites, hacelo. Lo importante es que el resultado final sea correcto, limpio y mantenible.
