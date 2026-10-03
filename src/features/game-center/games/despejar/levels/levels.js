/**
 * Niveles de «Despejar el estacionamiento», generados por scripts/generate-parking-jam.mjs
 * (no editar a mano). Todos tienen solución (las pruebas la vuelven a buscar).
 *   par            movimientos de una solución encontrada (referencia para las estrellas)
 *   rounds         tandas de salidas necesarias · needsManeuver: hay que apartar un coche a medias
 *   traps          primeros movimientos que dejan el tablero sin solución
 */
export const LEVELS = Object.freeze([
  {
    "id": "n1-1",
    "name": "Primeros pasos 1",
    "width": 5,
    "height": 5,
    "exits": [
      {
        "side": "bottom",
        "index": 2
      },
      {
        "side": "right",
        "index": 2
      },
      {
        "side": "top",
        "index": 1
      },
      {
        "side": "right",
        "index": 1
      }
    ],
    "walls": [],
    "cars": [
      {
        "id": "a",
        "row": 0,
        "col": 2,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 242
      },
      {
        "id": "b",
        "row": 2,
        "col": 1,
        "length": 2,
        "axis": "h",
        "dir": "right",
        "hue": 292
      },
      {
        "id": "c",
        "row": 2,
        "col": 3,
        "length": 2,
        "axis": "h",
        "dir": "right",
        "hue": 96
      },
      {
        "id": "d",
        "row": 3,
        "col": 1,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 358
      }
    ],
    "par": 4,
    "rounds": 3,
    "needsManeuver": false,
    "traps": 0
  },
  {
    "id": "n1-2",
    "name": "Primeros pasos 2",
    "width": 5,
    "height": 5,
    "exits": [
      {
        "side": "top",
        "index": 3
      },
      {
        "side": "top",
        "index": 1
      },
      {
        "side": "left",
        "index": 2
      },
      {
        "side": "left",
        "index": 3
      }
    ],
    "walls": [],
    "cars": [
      {
        "id": "a",
        "row": 3,
        "col": 2,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 79
      },
      {
        "id": "b",
        "row": 0,
        "col": 1,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 7
      },
      {
        "id": "c",
        "row": 2,
        "col": 3,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 349
      },
      {
        "id": "d",
        "row": 3,
        "col": 1,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 56
      },
      {
        "id": "e",
        "row": 2,
        "col": 1,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 184
      }
    ],
    "par": 5,
    "rounds": 3,
    "needsManeuver": false,
    "traps": 0
  },
  {
    "id": "n1-3",
    "name": "Primeros pasos 3",
    "width": 5,
    "height": 5,
    "exits": [
      {
        "side": "left",
        "index": 1
      },
      {
        "side": "right",
        "index": 4
      },
      {
        "side": "bottom",
        "index": 1
      },
      {
        "side": "top",
        "index": 2
      }
    ],
    "walls": [],
    "cars": [
      {
        "id": "a",
        "row": 2,
        "col": 1,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 219
      },
      {
        "id": "b",
        "row": 1,
        "col": 2,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 26
      },
      {
        "id": "c",
        "row": 1,
        "col": 0,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 112
      },
      {
        "id": "d",
        "row": 4,
        "col": 0,
        "length": 2,
        "axis": "h",
        "dir": "right",
        "hue": 149
      },
      {
        "id": "e",
        "row": 3,
        "col": 2,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 97
      }
    ],
    "par": 5,
    "rounds": 5,
    "needsManeuver": false,
    "traps": 0
  },
  {
    "id": "n2-1",
    "name": "Hora punta 1",
    "width": 6,
    "height": 6,
    "exits": [
      {
        "side": "left",
        "index": 4
      },
      {
        "side": "top",
        "index": 0
      },
      {
        "side": "top",
        "index": 4
      }
    ],
    "walls": [],
    "cars": [
      {
        "id": "a",
        "row": 4,
        "col": 2,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 259
      },
      {
        "id": "b",
        "row": 0,
        "col": 4,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 213
      },
      {
        "id": "c",
        "row": 1,
        "col": 0,
        "length": 3,
        "axis": "v",
        "dir": "up",
        "hue": 115
      },
      {
        "id": "d",
        "row": 4,
        "col": 4,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 186
      },
      {
        "id": "e",
        "row": 4,
        "col": 0,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 306
      },
      {
        "id": "f",
        "row": 2,
        "col": 4,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 69
      }
    ],
    "par": 6,
    "rounds": 4,
    "needsManeuver": false,
    "traps": 0
  },
  {
    "id": "n2-2",
    "name": "Hora punta 2",
    "width": 6,
    "height": 6,
    "exits": [
      {
        "side": "top",
        "index": 1
      },
      {
        "side": "left",
        "index": 1
      },
      {
        "side": "left",
        "index": 5
      },
      {
        "side": "top",
        "index": 5
      }
    ],
    "walls": [],
    "cars": [
      {
        "id": "a",
        "row": 0,
        "col": 5,
        "length": 3,
        "axis": "v",
        "dir": "up",
        "hue": 122
      },
      {
        "id": "b",
        "row": 5,
        "col": 4,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 70
      },
      {
        "id": "c",
        "row": 4,
        "col": 1,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 291
      },
      {
        "id": "d",
        "row": 1,
        "col": 3,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 286
      },
      {
        "id": "e",
        "row": 1,
        "col": 1,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 66
      },
      {
        "id": "f",
        "row": 5,
        "col": 2,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 150
      },
      {
        "id": "g",
        "row": 3,
        "col": 5,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 273
      }
    ],
    "par": 7,
    "rounds": 4,
    "needsManeuver": false,
    "traps": 0
  },
  {
    "id": "n2-3",
    "name": "Hora punta 3",
    "width": 6,
    "height": 6,
    "exits": [
      {
        "side": "top",
        "index": 4
      },
      {
        "side": "left",
        "index": 0
      },
      {
        "side": "right",
        "index": 2
      },
      {
        "side": "right",
        "index": 4
      }
    ],
    "walls": [
      "1,2"
    ],
    "cars": [
      {
        "id": "a",
        "row": 4,
        "col": 2,
        "length": 2,
        "axis": "h",
        "dir": "right",
        "hue": 50
      },
      {
        "id": "b",
        "row": 2,
        "col": 2,
        "length": 3,
        "axis": "h",
        "dir": "right",
        "hue": 221
      },
      {
        "id": "c",
        "row": 0,
        "col": 0,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 111
      },
      {
        "id": "d",
        "row": 0,
        "col": 2,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 282
      },
      {
        "id": "e",
        "row": 2,
        "col": 0,
        "length": 2,
        "axis": "h",
        "dir": "right",
        "hue": 108
      },
      {
        "id": "f",
        "row": 3,
        "col": 4,
        "length": 3,
        "axis": "v",
        "dir": "up",
        "hue": 55
      },
      {
        "id": "g",
        "row": 0,
        "col": 4,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 236
      }
    ],
    "par": 7,
    "rounds": 5,
    "needsManeuver": false,
    "traps": 0
  },
  {
    "id": "n3-1",
    "name": "Atasco 1",
    "width": 6,
    "height": 6,
    "exits": [
      {
        "side": "right",
        "index": 2
      },
      {
        "side": "bottom",
        "index": 1
      },
      {
        "side": "bottom",
        "index": 0
      },
      {
        "side": "left",
        "index": 1
      }
    ],
    "walls": [
      "3,2"
    ],
    "cars": [
      {
        "id": "a",
        "row": 2,
        "col": 1,
        "length": 2,
        "axis": "h",
        "dir": "right",
        "hue": 142
      },
      {
        "id": "b",
        "row": 1,
        "col": 1,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 18
      },
      {
        "id": "c",
        "row": 4,
        "col": 0,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 283
      },
      {
        "id": "d",
        "row": 1,
        "col": 3,
        "length": 3,
        "axis": "h",
        "dir": "left",
        "hue": 60
      },
      {
        "id": "e",
        "row": 3,
        "col": 1,
        "length": 3,
        "axis": "v",
        "dir": "down",
        "hue": 68
      },
      {
        "id": "f",
        "row": 2,
        "col": 0,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 158
      },
      {
        "id": "g",
        "row": 2,
        "col": 4,
        "length": 2,
        "axis": "h",
        "dir": "right",
        "hue": 139
      },
      {
        "id": "h",
        "row": 0,
        "col": 0,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 142
      }
    ],
    "par": 8,
    "rounds": 5,
    "needsManeuver": false,
    "traps": 0
  },
  {
    "id": "n3-2",
    "name": "Atasco 2",
    "width": 6,
    "height": 6,
    "exits": [
      {
        "side": "right",
        "index": 2
      },
      {
        "side": "left",
        "index": 5
      },
      {
        "side": "bottom",
        "index": 5
      },
      {
        "side": "top",
        "index": 2
      }
    ],
    "walls": [
      "3,1"
    ],
    "cars": [
      {
        "id": "a",
        "row": 2,
        "col": 2,
        "length": 3,
        "axis": "h",
        "dir": "right",
        "hue": 87
      },
      {
        "id": "b",
        "row": 4,
        "col": 5,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 345
      },
      {
        "id": "c",
        "row": 3,
        "col": 2,
        "length": 3,
        "axis": "v",
        "dir": "up",
        "hue": 139
      },
      {
        "id": "d",
        "row": 2,
        "col": 5,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 113
      },
      {
        "id": "e",
        "row": 2,
        "col": 0,
        "length": 2,
        "axis": "h",
        "dir": "right",
        "hue": 220
      },
      {
        "id": "f",
        "row": 0,
        "col": 2,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 343
      },
      {
        "id": "g",
        "row": 0,
        "col": 5,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 176
      },
      {
        "id": "h",
        "row": 5,
        "col": 0,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 334
      },
      {
        "id": "i",
        "row": 5,
        "col": 3,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 180
      }
    ],
    "par": 9,
    "rounds": 5,
    "needsManeuver": false,
    "traps": 0
  },
  {
    "id": "n3-3",
    "name": "Atasco 3",
    "width": 6,
    "height": 6,
    "exits": [
      {
        "side": "bottom",
        "index": 4
      },
      {
        "side": "left",
        "index": 3
      },
      {
        "side": "bottom",
        "index": 0
      },
      {
        "side": "left",
        "index": 5
      }
    ],
    "walls": [
      "2,1"
    ],
    "cars": [
      {
        "id": "a",
        "row": 0,
        "col": 0,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 2
      },
      {
        "id": "b",
        "row": 5,
        "col": 1,
        "length": 3,
        "axis": "h",
        "dir": "left",
        "hue": 289
      },
      {
        "id": "c",
        "row": 0,
        "col": 4,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 324
      },
      {
        "id": "d",
        "row": 3,
        "col": 0,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 291
      },
      {
        "id": "e",
        "row": 3,
        "col": 4,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 269
      },
      {
        "id": "f",
        "row": 5,
        "col": 4,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 242
      },
      {
        "id": "g",
        "row": 3,
        "col": 2,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 40
      },
      {
        "id": "h",
        "row": 4,
        "col": 0,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 270
      }
    ],
    "par": 8,
    "rounds": 5,
    "needsManeuver": false,
    "traps": 0
  },
  {
    "id": "n4-1",
    "name": "Centro comercial 1",
    "width": 7,
    "height": 7,
    "exits": [
      {
        "side": "left",
        "index": 2
      },
      {
        "side": "right",
        "index": 1
      },
      {
        "side": "bottom",
        "index": 0
      },
      {
        "side": "bottom",
        "index": 5
      },
      {
        "side": "bottom",
        "index": 6
      }
    ],
    "walls": [
      "4,4",
      "5,5",
      "3,5"
    ],
    "cars": [
      {
        "id": "a",
        "row": 3,
        "col": 6,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 47
      },
      {
        "id": "b",
        "row": 2,
        "col": 0,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 175
      },
      {
        "id": "c",
        "row": 4,
        "col": 0,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 312
      },
      {
        "id": "d",
        "row": 0,
        "col": 6,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 325
      },
      {
        "id": "e",
        "row": 2,
        "col": 3,
        "length": 3,
        "axis": "h",
        "dir": "left",
        "hue": 217
      },
      {
        "id": "f",
        "row": 1,
        "col": 0,
        "length": 2,
        "axis": "h",
        "dir": "right",
        "hue": 355
      },
      {
        "id": "g",
        "row": 1,
        "col": 4,
        "length": 2,
        "axis": "h",
        "dir": "right",
        "hue": 144
      },
      {
        "id": "h",
        "row": 1,
        "col": 2,
        "length": 2,
        "axis": "h",
        "dir": "right",
        "hue": 134
      },
      {
        "id": "i",
        "row": 5,
        "col": 6,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 94
      }
    ],
    "par": 9,
    "rounds": 6,
    "needsManeuver": false,
    "traps": 0
  },
  {
    "id": "n4-2",
    "name": "Centro comercial 2",
    "width": 7,
    "height": 7,
    "exits": [
      {
        "side": "right",
        "index": 6
      },
      {
        "side": "left",
        "index": 1
      },
      {
        "side": "top",
        "index": 6
      }
    ],
    "walls": [
      "2,1",
      "5,3",
      "5,4"
    ],
    "cars": [
      {
        "id": "a",
        "row": 1,
        "col": 4,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 271
      },
      {
        "id": "b",
        "row": 1,
        "col": 0,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 300
      },
      {
        "id": "c",
        "row": 1,
        "col": 6,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 261
      },
      {
        "id": "d",
        "row": 6,
        "col": 2,
        "length": 2,
        "axis": "h",
        "dir": "right",
        "hue": 257
      },
      {
        "id": "e",
        "row": 6,
        "col": 4,
        "length": 2,
        "axis": "h",
        "dir": "right",
        "hue": 153
      },
      {
        "id": "f",
        "row": 5,
        "col": 6,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 341
      },
      {
        "id": "g",
        "row": 3,
        "col": 6,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 280
      },
      {
        "id": "h",
        "row": 1,
        "col": 2,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 101
      },
      {
        "id": "i",
        "row": 6,
        "col": 0,
        "length": 2,
        "axis": "h",
        "dir": "right",
        "hue": 140
      }
    ],
    "par": 9,
    "rounds": 6,
    "needsManeuver": false,
    "traps": 0
  },
  {
    "id": "n4-3",
    "name": "Centro comercial 3",
    "width": 7,
    "height": 7,
    "exits": [
      {
        "side": "left",
        "index": 1
      },
      {
        "side": "bottom",
        "index": 3
      },
      {
        "side": "bottom",
        "index": 0
      },
      {
        "side": "top",
        "index": 5
      },
      {
        "side": "bottom",
        "index": 6
      }
    ],
    "walls": [
      "4,4",
      "2,1",
      "4,2"
    ],
    "cars": [
      {
        "id": "a",
        "row": 3,
        "col": 6,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 6
      },
      {
        "id": "b",
        "row": 1,
        "col": 2,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 310
      },
      {
        "id": "c",
        "row": 1,
        "col": 5,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 7
      },
      {
        "id": "d",
        "row": 1,
        "col": 0,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 219
      },
      {
        "id": "e",
        "row": 4,
        "col": 0,
        "length": 3,
        "axis": "v",
        "dir": "down",
        "hue": 192
      },
      {
        "id": "f",
        "row": 4,
        "col": 5,
        "length": 3,
        "axis": "v",
        "dir": "up",
        "hue": 57
      },
      {
        "id": "g",
        "row": 5,
        "col": 3,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 352
      },
      {
        "id": "h",
        "row": 2,
        "col": 3,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 200
      },
      {
        "id": "i",
        "row": 5,
        "col": 6,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 125
      },
      {
        "id": "j",
        "row": 2,
        "col": 5,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 292
      }
    ],
    "par": 10,
    "rounds": 6,
    "needsManeuver": false,
    "traps": 0
  },
  {
    "id": "n5-1",
    "name": "Gran aparcamiento 1",
    "width": 7,
    "height": 7,
    "exits": [
      {
        "side": "top",
        "index": 0
      },
      {
        "side": "right",
        "index": 2
      },
      {
        "side": "top",
        "index": 6
      },
      {
        "side": "right",
        "index": 0
      }
    ],
    "walls": [
      "1,1",
      "3,2",
      "3,5"
    ],
    "cars": [
      {
        "id": "a",
        "row": 2,
        "col": 2,
        "length": 2,
        "axis": "h",
        "dir": "right",
        "hue": 40
      },
      {
        "id": "b",
        "row": 2,
        "col": 6,
        "length": 3,
        "axis": "v",
        "dir": "up",
        "hue": 4
      },
      {
        "id": "c",
        "row": 0,
        "col": 1,
        "length": 2,
        "axis": "h",
        "dir": "right",
        "hue": 126
      },
      {
        "id": "d",
        "row": 2,
        "col": 0,
        "length": 2,
        "axis": "h",
        "dir": "right",
        "hue": 45
      },
      {
        "id": "e",
        "row": 3,
        "col": 0,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 194
      },
      {
        "id": "f",
        "row": 0,
        "col": 6,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 137
      },
      {
        "id": "g",
        "row": 0,
        "col": 3,
        "length": 2,
        "axis": "h",
        "dir": "right",
        "hue": 226
      },
      {
        "id": "h",
        "row": 0,
        "col": 0,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 266
      },
      {
        "id": "i",
        "row": 2,
        "col": 4,
        "length": 2,
        "axis": "h",
        "dir": "right",
        "hue": 29
      },
      {
        "id": "j",
        "row": 5,
        "col": 6,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 243
      },
      {
        "id": "k",
        "row": 5,
        "col": 0,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 214
      }
    ],
    "par": 11,
    "rounds": 7,
    "needsManeuver": false,
    "traps": 0
  },
  {
    "id": "n5-2",
    "name": "Gran aparcamiento 2",
    "width": 7,
    "height": 7,
    "exits": [
      {
        "side": "top",
        "index": 2
      },
      {
        "side": "bottom",
        "index": 0
      },
      {
        "side": "left",
        "index": 6
      },
      {
        "side": "bottom",
        "index": 5
      }
    ],
    "walls": [
      "2,1",
      "1,1"
    ],
    "cars": [
      {
        "id": "a",
        "row": 5,
        "col": 0,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 313
      },
      {
        "id": "b",
        "row": 0,
        "col": 0,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 309
      },
      {
        "id": "c",
        "row": 3,
        "col": 2,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 357
      },
      {
        "id": "d",
        "row": 4,
        "col": 5,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 114
      },
      {
        "id": "e",
        "row": 2,
        "col": 0,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 219
      },
      {
        "id": "f",
        "row": 6,
        "col": 3,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 41
      },
      {
        "id": "g",
        "row": 2,
        "col": 5,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 116
      },
      {
        "id": "h",
        "row": 0,
        "col": 5,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 149
      },
      {
        "id": "i",
        "row": 0,
        "col": 2,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 196
      },
      {
        "id": "j",
        "row": 6,
        "col": 5,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 241
      },
      {
        "id": "k",
        "row": 5,
        "col": 2,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 36
      }
    ],
    "par": 11,
    "rounds": 8,
    "needsManeuver": false,
    "traps": 0
  },
  {
    "id": "n5-3",
    "name": "Gran aparcamiento 3",
    "width": 7,
    "height": 7,
    "exits": [
      {
        "side": "bottom",
        "index": 6
      },
      {
        "side": "top",
        "index": 2
      },
      {
        "side": "left",
        "index": 6
      },
      {
        "side": "top",
        "index": 0
      }
    ],
    "walls": [
      "3,1",
      "3,3"
    ],
    "cars": [
      {
        "id": "a",
        "row": 6,
        "col": 1,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 1
      },
      {
        "id": "b",
        "row": 0,
        "col": 6,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 282
      },
      {
        "id": "c",
        "row": 3,
        "col": 6,
        "length": 2,
        "axis": "v",
        "dir": "down",
        "hue": 313
      },
      {
        "id": "d",
        "row": 6,
        "col": 5,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 342
      },
      {
        "id": "e",
        "row": 2,
        "col": 2,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 256
      },
      {
        "id": "f",
        "row": 0,
        "col": 0,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 334
      },
      {
        "id": "g",
        "row": 6,
        "col": 3,
        "length": 2,
        "axis": "h",
        "dir": "left",
        "hue": 2
      },
      {
        "id": "h",
        "row": 3,
        "col": 0,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 166
      },
      {
        "id": "i",
        "row": 4,
        "col": 2,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 257
      },
      {
        "id": "j",
        "row": 0,
        "col": 2,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 115
      },
      {
        "id": "k",
        "row": 5,
        "col": 0,
        "length": 2,
        "axis": "v",
        "dir": "up",
        "hue": 23
      }
    ],
    "par": 11,
    "rounds": 8,
    "needsManeuver": false,
    "traps": 0
  }
]);
