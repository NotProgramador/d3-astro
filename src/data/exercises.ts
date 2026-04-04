export interface ExerciseItem {
  id: string;
  title: string;
  duration?: string;
  summary: string;
  description?: string;
  objective?: string;
  recommendation?: string;
  idealFor?: string[];
  variants?: string[];
  examples?: string[];
  materials?: string[];
  steps?: string[];
  mistakes?: string[];
  image?: {
    src: string;
    alt?: string;
    caption?: string;
  };
  youtube?: {
    embed: string;
    watch?: string;
  };
  supportMaterials?: {
    label: string;
    file: string;
  }[];
  level?: "inicial" | "intermedio";
  tags?: string[];
  featured?: boolean;
  order?: number;
}

export const exercises: ExerciseItem[] = [
  {
    id: "contorno-ciego",
    title: "Línea continua sin ver",
    duration: "10 min",
    summary: "Dibuja un objeto sin despegar la herramienta y sin mirar el papel.",
    description:
      "Coloca la pluma o lápiz sobre el papel y dibuja un objeto sin despegar la punta y sin mirar la hoja. Si rompes cualquiera de esas dos reglas, el dibujo termina.",
    objective:
      "Entrenar la observación real, la coordinación ojo-mano y dejar de depender de símbolos mentales.",
    recommendation:
      "Empieza con objetos simples y aislados como tu mano, una taza, unas llaves o un termo.",
    idealFor: [
      "Perder miedo al error",
      "Observar más de lo que corriges",
      "Entrenar atención sostenida"
    ],
    variants: [
      "Tiempo libre",
      "1 minuto",
      "3 minutos",
      "Solo contorno exterior",
      "Contorno exterior + detalles internos"
    ],
    examples: ["Tu mano", "Una taza", "Un termo", "Unas llaves"],
    materials: ["Papel", "Pluma o lápiz"],
    mistakes: [
      "Mirar constantemente la hoja",
      "Intentar corregir el dibujo",
      "Mover la mano demasiado rápido"
    ],
    youtube: {
      embed: "https://www.youtube.com/embed/VIDEO_ID_1",
      watch: "https://www.youtube.com/watch?v=VIDEO_ID_1"
    },
    level: "inicial",
    tags: ["observación", "contorno", "línea", "soltura"],
    featured: true,
    order: 1
  },
  {
    id: "linea-continua-viendo",
    title: "Línea continua viendo",
    duration: "10 a 15 min",
    summary: "La misma lógica de línea continua, pero ahora sí puedes ver el papel.",
    description:
      "Dibuja sin despegar la herramienta de la hoja, pero mirando tanto el objeto como el papel.",
    objective:
      "Desarrollar fluidez, seguridad en el trazo y capacidad de simplificar recorridos visuales.",
    recommendation:
      "Usar pluma ayuda mucho porque obliga a aceptar el error y seguir.",
    variants: [
      "Dibujar más lento para observar mejor",
      "Dibujar más rápido para soltar la mano",
      "Repetir el mismo objeto 3 veces"
    ],
    materials: ["Papel", "Pluma o lápiz"],
    mistakes: [
      "Levantar la herramienta constantemente",
      "Querer corregir cada línea",
      "Perder el ritmo del recorrido visual"
    ],
    youtube: {
      embed: "https://www.youtube.com/embed/VIDEO_ID_2",
      watch: "https://www.youtube.com/watch?v=VIDEO_ID_2"
    },
    level: "inicial",
    tags: ["línea", "fluidez", "observación"],
    order: 2
  },
  {
    id: "contorno-del-objeto",
    title: "Contorno del objeto",
    duration: "10 min",
    summary: "Dibuja solo el borde exterior del objeto antes de entrar a detalles.",
    description:
      "Se trata de dibujar únicamente la silueta general del objeto, sin sombras ni detalles internos al inicio.",
    objective:
      "Aprender a reconocer la silueta real de las cosas y su proporción general.",
    recommendation:
      "Es muy útil para principiantes porque enseña a ver hasta dónde llega un objeto.",
    examples: ["Botella", "Mochila", "Planta", "Zapato", "Silla sencilla"],
    materials: ["Papel", "Lápiz o pluma"],
    mistakes: [
      "Entrar en detalles demasiado pronto",
      "No comparar altura y anchura",
      "Dibujar por memoria en vez de observar"
    ],
    level: "inicial",
    tags: ["contorno", "proporción", "observación"],
    order: 3
  },
  {
    id: "dibujo-en-negativo",
    title: "Dibujo en negativo",
    duration: "15 min",
    summary: "En vez de dibujar el objeto, dibuja los espacios que lo rodean.",
    description:
      "Observa los huecos entre partes del objeto o entre el objeto y el fondo, y dibuja esas formas en lugar del objeto mismo.",
    objective:
      "Romper la idea mental del objeto y aprender a observar formas reales.",
    recommendation:
      "Funciona muy bien con sillas, plantas, manos entreabiertas, bicicletas o muebles.",
    examples: [
      "Huecos entre patas y respaldo de una silla",
      "Espacios entre hojas de una planta",
      "Aberturas entre dedos"
    ],
    mistakes: [
      "Pensar demasiado en el nombre del objeto",
      "No prestar atención a las formas vacías",
      "Irte directo al contorno tradicional"
    ],
    youtube: {
      embed: "https://www.youtube.com/embed/VIDEO_ID_3",
      watch: "https://www.youtube.com/watch?v=VIDEO_ID_3"
    },
    level: "inicial",
    tags: ["observación", "espacio negativo", "proporción"],
    featured: true,
    order: 4
  },
  {
    id: "dibujos-rapidos",
    title: "Dibujos rápidos por tiempo",
    duration: "15 a 20 min",
    summary: "Haz dibujos de 30 segundos, 1 minuto, 3 minutos y 5 minutos.",
    description:
      "Dibuja el mismo objeto o varios objetos en tiempos cortos para sintetizar y decidir qué es lo más importante.",
    objective:
      "Aprender a sintetizar formas, distinguir lo esencial y ganar soltura.",
    recommendation:
      "No busques detalle bonito. Busca estructura, gesto y proporción general.",
    variants: ["30 segundos", "1 minuto", "3 minutos", "5 minutos"],
    idealFor: [
      "Velocidad de observación",
      "Toma de decisiones",
      "Soltura",
      "Proporción general"
    ],
    materials: ["Cronómetro", "Papel", "Lápiz o pluma"],
    mistakes: [
      "Gastar todo el tiempo en una sola parte",
      "Buscar acabado final",
      "No repetir suficientes rondas"
    ],
    level: "inicial",
    tags: ["síntesis", "soltura", "observación"],
    featured: true,
    order: 5
  },
  {
    id: "mismo-objeto-perspectivas",
    title: "Un mismo objeto desde distintas perspectivas",
    duration: "15 min",
    summary: "Dibuja el mismo objeto varias veces cambiando el punto de vista.",
    description:
      "Observa cómo cambia el objeto al verlo de frente, perfil, desde arriba, desde abajo o a tres cuartos.",
    objective:
      "Comprender que un objeto cambia según desde dónde se observa.",
    recommendation:
      "Usa objetos simples como una taza, una caja, un zapato o una botella.",
    variants: [
      "Frente",
      "Perfil",
      "Desde arriba",
      "Desde abajo",
      "Tres cuartos"
    ],
    mistakes: [
      "Repetir siempre la misma vista",
      "Dibujar desde memoria",
      "No comparar proporciones entre vistas"
    ],
    level: "inicial",
    tags: ["perspectiva", "observación", "volumen"],
    order: 6
  },
  {
    id: "ejercicios-de-trazo",
    title: "Ejercicios de trazo",
    duration: "10 a 15 min",
    summary: "Llena hojas con líneas, curvas, espirales, círculos y cambios de dirección.",
    description:
      "Este ejercicio sirve para mejorar control, ritmo y confianza en la mano. No busca hacer dibujos bonitos, sino entrenar el gesto.",
    objective:
      "Mejorar control, ritmo y seguridad en el trazo.",
    recommendation:
      "Hazlo como calentamiento antes de dibujar objetos reales.",
    variants: [
      "Líneas paralelas horizontales",
      "Líneas diagonales",
      "Círculos repetidos",
      "Óvalos alargados",
      "Curvas en S",
      "Trazos largos de lado a lado de la hoja"
    ],
    materials: ["Papel", "Lápiz o pluma"],
    supportMaterials: [
      {
        label: "Descargar plantilla de trazos",
        file: "/downloads/plantilla-trazos.pdf"
      }
    ],
    mistakes: [
      "Hacer trazos demasiado cortos",
      "Dibujar con tensión excesiva",
      "No repetir suficientes series"
    ],
    level: "inicial",
    tags: ["trazo", "calentamiento", "soltura"],
    featured: true,
    order: 7
  },
  {
    id: "formas-basicas",
    title: "Repetición de formas básicas",
    duration: "15 min",
    summary: "Repite cubos, cilindros, esferas, conos, rectángulos y óvalos.",
    description:
      "Dibuja muchas veces formas simples para entender que casi todo lo que vemos puede simplificarse así.",
    objective:
      "Desarrollar comprensión estructural y construir objetos complejos desde formas simples.",
    recommendation:
      "No lo veas como geometría rígida, sino como una herramienta para construir.",
    examples: [
      "Taza = cilindro + asa",
      "Botella = cilindros y curvas",
      "Cabeza = esfera + eje + mandíbula"
    ],
    materials: ["Papel", "Lápiz"],
    supportMaterials: [
      {
        label: "Descargar guía de formas básicas",
        file: "/downloads/guia-formas-basicas.pdf"
      }
    ],
    level: "inicial",
    tags: ["formas básicas", "estructura", "construcción"],
    featured: true,
    order: 8
  },
  {
    id: "construccion-formas",
    title: "Construcción por formas simples",
    duration: "15 a 20 min",
    summary: "Antes de dibujar el objeto completo, descompónlo en figuras simples.",
    description:
      "En lugar de copiar visualmente el contorno final, primero traduce el objeto a cilindros, bloques, masas y ejes.",
    objective:
      "Pasar de copiar visualmente a entender cómo está construido un objeto.",
    recommendation:
      "Es un gran puente entre observar y construir.",
    examples: [
      "Termo = cilindro",
      "Zapato = bloque inclinado + curva",
      "Planta = eje + masas generales",
      "Silla = prismas y líneas estructurales"
    ],
    mistakes: [
      "Irte directo al acabado",
      "Ignorar ejes principales",
      "No simplificar suficiente"
    ],
    youtube: {
      embed: "https://www.youtube.com/embed/VIDEO_ID_4",
      watch: "https://www.youtube.com/watch?v=VIDEO_ID_4"
    },
    level: "inicial",
    tags: ["construcción", "estructura", "formas básicas"],
    featured: true,
    order: 9
  },
  {
    id: "dos-manos",
    title: "Dibujo a dos manos",
    duration: "5 a 10 min",
    summary: "Dibuja al mismo tiempo con ambas manos para soltar el control.",
    description:
      "Puedes intentar hacer la misma forma con ambas manos o trabajar formas espejo simultáneas.",
    objective:
      "Soltar control excesivo, activar coordinación y perder miedo al error.",
    recommendation:
      "No importa el resultado. Importa el ejercicio corporal y mental.",
    variants: [
      "Dos círculos simultáneos",
      "Líneas espejo",
      "Un objeto simple con ambas manos"
    ],
    materials: ["Dos lápices o plumones", "Papel"],
    mistakes: [
      "Buscar precisión",
      "Comparar una mano con la otra",
      "Frustrarte con el resultado"
    ],
    level: "inicial",
    tags: ["soltura", "coordinación", "desbloqueo"],
    order: 10
  },
  {
    id: "mano-contraria",
    title: "Dibujar con la mano contraria",
    duration: "10 min",
    summary: "Usa la mano no dominante para romper automatismos.",
    description:
      "Haz contornos, dibujos rápidos o líneas continuas con la mano contraria para enfocarte más en observar que en controlar.",
    objective:
      "Quitar rigidez, romper automatismos y observar mejor.",
    recommendation:
      "Muy útil cuando hay frustración por querer controlar demasiado el resultado.",
    idealFor: ["Contornos", "Línea continua", "Dibujos rápidos"],
    mistakes: [
      "Exigirte el mismo resultado que con tu mano dominante",
      "Ir demasiado rápido",
      "Abandonar por incomodidad inicial"
    ],
    level: "inicial",
    tags: ["desbloqueo", "soltura", "observación"],
    order: 11
  },
  {
    id: "medicion-visual",
    title: "Medición visual básica",
    duration: "15 min",
    summary: "Compara proporciones a ojo o usando el lápiz como referencia visual.",
    description:
      "Con el brazo extendido, usa el lápiz para comparar alturas, anchos, inclinaciones y distancias entre partes.",
    objective:
      "Aprender a ver tamaños relativos y relaciones entre partes.",
    recommendation:
      "Es clave para pasar del dibujo simbólico al dibujo observado.",
    idealFor: [
      "Altura vs anchura",
      "Ángulos",
      "Distancias entre partes",
      "Relaciones entre objetos"
    ],
    mistakes: [
      "Medir una vez y no volver a comprobar",
      "No comparar inclinaciones",
      "Confiar solo en intuición"
    ],
    level: "intermedio",
    tags: ["medición", "proporción", "observación"],
    order: 12
  },
  {
    id: "encaje-general",
    title: "Encaje general del objeto",
    duration: "10 a 15 min",
    summary: "Ubica el objeto en la hoja antes de detallar.",
    description:
      "Antes de dibujar detalles, marca altura, anchura, eje, inclinaciones y masas principales.",
    objective:
      "Evitar empezar por detalles y perder proporción o espacio en la hoja.",
    steps: [
      "Ubica altura y anchura general",
      "Marca inclinación o eje principal",
      "Indica masas principales",
      "Ajusta antes de detallar"
    ],
    recommendation:
      "Este ejercicio debería acompañar casi todos los demás.",
    supportMaterials: [
      {
        label: "Descargar guía de encaje",
        file: "/downloads/guia-encaje.pdf"
      }
    ],
    level: "inicial",
    tags: ["encaje", "proporción", "estructura"],
    featured: true,
    order: 13
  },
  {
    id: "luz-sombra",
    title: "Luz y sombra básica",
    duration: "15 a 20 min",
    summary: "Observa dónde cae la luz y dónde aparecen sombras y medios tonos.",
    description:
      "Trabaja con un objeto sencillo y una luz lateral clara. Empieza viendo grandes masas antes que detalles.",
    objective:
      "Entender volumen de forma simple, sin entrar todavía en hiperrealismo.",
    recommendation:
      "Usa primero solo tres valores: claro, medio y oscuro.",
    examples: [
      "Una esfera",
      "Una taza",
      "Una fruta",
      "Una caja con lámpara lateral"
    ],
    materials: ["Objeto simple", "Lámpara lateral", "Papel", "Lápiz"],
    mistakes: [
      "Sombrear todo igual",
      "Empezar por detalles mínimos",
      "No dejar zonas claras"
    ],
    youtube: {
      embed: "https://www.youtube.com/embed/VIDEO_ID_5",
      watch: "https://www.youtube.com/watch?v=VIDEO_ID_5"
    },
    level: "intermedio",
    tags: ["luz", "sombra", "volumen"],
    featured: true,
    order: 14
  },
  {
    id: "naturaleza-muerta",
    title: "Naturaleza muerta sencilla",
    duration: "20 a 30 min",
    summary: "Arma una composición con dos o tres objetos y dibújala completa.",
    description:
      "Integra observación, proporción, contorno, estructura y relación entre objetos dentro de una sola práctica.",
    objective:
      "Unir varias habilidades en un solo ejercicio.",
    recommendation:
      "No hagas composiciones complicadas al principio. Mejor pocos objetos bien observados.",
    examples: [
      "Taza + cuchara + fruta",
      "Botella + libro",
      "Termo + libreta + planta pequeña"
    ],
    mistakes: [
      "Elegir demasiados objetos",
      "No ordenar bien la composición",
      "Detallar un objeto y abandonar el resto"
    ],
    level: "intermedio",
    tags: ["composición", "observación", "integración"],
    order: 15
  }
];

export const orderedExercises = [...exercises].sort(
  (a, b) => (a.order ?? 999) - (b.order ?? 999)
);