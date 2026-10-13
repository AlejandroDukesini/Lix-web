/**
 * Catálogo del observatorio: estrellas brillantes reales (coordenadas J2000
 * redondeadas: ascensión recta en horas, declinación en grados), magnitud
 * aparente, distancia aproximada en años luz (null si es muy incierta) y tipo
 * espectral (da el color). Las líneas de las constelaciones son las figuras
 * habituales. Las estrellas tenues del fondo se generan aparte y no se pueden
 * seleccionar: solo lo de este archivo es «real» y consultable.
 */

// id, nombre, constelación, AR (h), Dec (°), magnitud, distancia (al), espectro, nota
const S = (id, name, con, ra, dec, mag, dist, spec, note = null) => ({ id, name, con, ra, dec, mag, dist, spec, note, kind: 'star' });

export const STARS = Object.freeze([
  // Orión
  S('betelgeuse', 'Betelgeuse', 'ori', 5.919, 7.41, 0.5, 550, 'M', 'Supergigante roja: en el lugar del Sol llegaría más allá de la órbita de Marte. Su brillo varía.'),
  S('rigel', 'Rigel', 'ori', 5.242, -8.2, 0.13, 860, 'B', 'Supergigante azul, decenas de miles de veces más luminosa que el Sol.'),
  S('bellatrix', 'Bellatrix', 'ori', 5.418, 6.35, 1.64, 250, 'B'),
  S('mintaka', 'Mintaka', 'ori', 5.533, -0.3, 2.25, null, 'O', 'La primera de las tres estrellas del cinturón.'),
  S('alnilam', 'Alnilam', 'ori', 5.604, -1.2, 1.69, null, 'B', 'La estrella central del cinturón.'),
  S('alnitak', 'Alnitak', 'ori', 5.679, -1.94, 1.77, null, 'O'),
  S('saiph', 'Saiph', 'ori', 5.796, -9.67, 2.07, null, 'B'),
  // Can Mayor y Can Menor
  S('sirio', 'Sirio', 'cma', 6.752, -16.72, -1.46, 8.6, 'A', 'La estrella más brillante del cielo nocturno.'),
  S('mirzam', 'Mirzam', 'cma', 6.378, -17.96, 1.98, null, 'B'),
  S('adhara', 'Adhara', 'cma', 6.977, -28.97, 1.5, 430, 'B'),
  S('wezen', 'Wezen', 'cma', 7.14, -26.39, 1.83, null, 'F'),
  S('aludra', 'Aludra', 'cma', 7.402, -29.3, 2.45, null, 'B'),
  S('furud', 'Furud', 'cma', 6.338, -30.06, 3.0, null, 'B'),
  S('procyon', 'Proción', 'cmi', 7.655, 5.22, 0.34, 11.5, 'F', 'Su nombre significa «antes del perro»: sale poco antes que Sirio.'),
  S('gomeisa', 'Gomeisa', 'cmi', 7.453, 8.29, 2.9, null, 'B'),
  // Tauro
  S('aldebaran', 'Aldebarán', 'tau', 4.599, 16.51, 0.85, 65, 'K', 'El ojo rojo del toro. Parece estar en las Híades, pero está mucho más cerca.'),
  S('elnath', 'Elnath', 'tau', 5.438, 28.61, 1.65, 130, 'B', 'Una punta de los cuernos del toro.'),
  S('tianguan', 'Tianguan', 'tau', 5.627, 21.14, 3.0, null, 'B'),
  S('hyadum', 'Hyadum I', 'tau', 4.33, 15.63, 3.65, 150, 'K'),
  S('ain', 'Ain', 'tau', 4.477, 19.18, 3.5, 150, 'K'),
  // Géminis
  S('castor', 'Cástor', 'gem', 7.577, 31.89, 1.58, 51, 'A', 'Un sistema de seis estrellas.'),
  S('pollux', 'Pólux', 'gem', 7.755, 28.03, 1.14, 34, 'K', 'Gigante naranja con un planeta confirmado.'),
  S('alhena', 'Alhena', 'gem', 6.629, 16.4, 1.93, null, 'A'),
  S('mebsuta', 'Mebsuta', 'gem', 6.732, 25.13, 3.0, null, 'G'),
  S('tejat', 'Tejat', 'gem', 6.383, 22.51, 2.9, null, 'M'),
  S('wasat', 'Wasat', 'gem', 7.335, 21.98, 3.5, null, 'F'),
  // Auriga
  S('capella', 'Capella', 'aur', 5.278, 46.0, 0.08, 43, 'G', 'Parece una sola estrella, pero son dos parejas.'),
  S('menkalinan', 'Menkalinan', 'aur', 5.992, 44.95, 1.9, 81, 'A'),
  S('mahasim', 'Mahasim', 'aur', 5.995, 37.21, 2.6, null, 'A'),
  S('hassaleh', 'Hassaleh', 'aur', 4.95, 33.17, 2.7, null, 'K'),
  S('almaaz', 'Almaaz', 'aur', 5.032, 43.82, 3.0, null, 'F'),
  // Osa Mayor (el Carro)
  S('dubhe', 'Dubhe', 'uma', 11.062, 61.75, 1.79, 123, 'K', 'Con Merak, señala la Polar: prolonga cinco veces la distancia entre ambas.'),
  S('merak', 'Merak', 'uma', 11.031, 56.38, 2.37, 79, 'A'),
  S('phecda', 'Phecda', 'uma', 11.897, 53.69, 2.44, 83, 'A'),
  S('megrez', 'Megrez', 'uma', 12.257, 57.03, 3.31, 81, 'A'),
  S('alioth', 'Alioth', 'uma', 12.9, 55.96, 1.77, 83, 'A'),
  S('mizar', 'Mizar', 'uma', 13.399, 54.93, 2.27, 83, 'A', 'Junto a la tenue Alcor forma una pareja famosa como prueba de vista.'),
  S('alkaid', 'Alkaid', 'uma', 13.792, 49.31, 1.86, 104, 'B'),
  // Osa Menor
  S('polaris', 'Polar', 'umi', 2.53, 89.26, 1.98, 430, 'F', 'Marca el norte: está a menos de un grado del polo celeste.'),
  S('kochab', 'Kochab', 'umi', 14.845, 74.16, 2.08, 130, 'K'),
  S('pherkad', 'Pherkad', 'umi', 15.345, 71.83, 3.05, null, 'A'),
  S('yildun', 'Yildun', 'umi', 17.537, 86.59, 4.35, null, 'A'),
  S('urodelus', 'Urodelus', 'umi', 16.766, 82.04, 4.2, null, 'G'),
  S('akhfa', 'Akhfa al Farkadain', 'umi', 15.734, 77.79, 4.3, null, 'A'),
  S('anwar', 'Anwar al Farkadain', 'umi', 16.292, 75.76, 4.95, null, 'F'),
  // Casiopea
  S('caph', 'Caph', 'cas', 0.153, 59.15, 2.27, 55, 'F'),
  S('schedar', 'Schedar', 'cas', 0.675, 56.54, 2.24, 230, 'K'),
  S('navi', 'Navi', 'cas', 0.945, 60.72, 2.15, null, 'B', 'El centro de la «W» de Casiopea.'),
  S('ruchbah', 'Ruchbah', 'cas', 1.43, 60.24, 2.68, 99, 'A'),
  S('segin', 'Segin', 'cas', 1.907, 63.67, 3.37, null, 'B'),
  // Cisne
  S('deneb', 'Deneb', 'cyg', 20.69, 45.28, 1.25, 2600, 'A', 'Una de las estrellas más luminosas conocidas. Su distancia es incierta (miles de años luz).'),
  S('sadr', 'Sadr', 'cyg', 20.37, 40.26, 2.23, null, 'F'),
  S('albireo', 'Albireo', 'cyg', 19.512, 27.96, 3.05, 430, 'K', 'Con telescopio se ve doble: una estrella dorada y otra azul.'),
  S('gienah', 'Gienah', 'cyg', 20.77, 33.97, 2.48, 72, 'K'),
  S('fawaris', 'Fawaris', 'cyg', 19.75, 45.13, 2.87, 165, 'B'),
  // Lira
  S('vega', 'Vega', 'lyr', 18.616, 38.78, 0.03, 25, 'A', 'Fue la estrella polar hace unos 14 000 años y volverá a serlo dentro de unos 12 000.'),
  S('sheliak', 'Sheliak', 'lyr', 18.835, 33.36, 3.5, null, 'B'),
  S('sulafat', 'Sulafat', 'lyr', 18.982, 32.69, 3.25, null, 'B'),
  S('zeta-lyr', 'ζ Lyrae', 'lyr', 18.746, 37.61, 4.3, null, 'A'),
  S('delta-lyr', 'δ Lyrae', 'lyr', 18.908, 36.9, 4.3, null, 'M'),
  // Águila
  S('altair', 'Altair', 'aql', 19.846, 8.87, 0.77, 16.7, 'A', 'Gira tan deprisa (una vuelta en unas 9 horas) que está achatada.'),
  S('tarazed', 'Tarazed', 'aql', 19.771, 10.61, 2.72, null, 'K'),
  S('alshain', 'Alshain', 'aql', 19.922, 6.41, 3.7, 45, 'G'),
  S('delta-aql', 'δ Aquilae', 'aql', 19.425, 3.11, 3.36, 50, 'F'),
  S('okab', 'Okab', 'aql', 19.09, 13.86, 2.99, 83, 'A'),
  S('lambda-aql', 'λ Aquilae', 'aql', 19.104, -4.88, 3.4, null, 'B'),
  // Escorpio
  S('antares', 'Antares', 'sco', 16.49, -26.43, 1.06, 550, 'M', 'Su nombre significa «rival de Marte», por su color rojo.'),
  S('acrab', 'Acrab', 'sco', 16.091, -19.81, 2.6, null, 'B'),
  S('dschubba', 'Dschubba', 'sco', 16.006, -22.62, 2.3, null, 'B'),
  S('fang', 'Fang', 'sco', 15.981, -26.11, 2.9, null, 'B'),
  S('alniyat', 'Alniyat', 'sco', 16.353, -25.59, 2.9, null, 'B'),
  S('paikauhale', 'Paikauhale', 'sco', 16.598, -28.22, 2.8, null, 'B'),
  S('larawag', 'Larawag', 'sco', 16.836, -34.29, 2.3, 64, 'K'),
  S('xamidimura', 'Xamidimura', 'sco', 16.864, -38.05, 3.0, null, 'B'),
  S('zeta-sco', 'ζ Scorpii', 'sco', 16.91, -42.36, 3.6, null, 'K'),
  S('eta-sco', 'η Scorpii', 'sco', 17.203, -43.24, 3.3, null, 'F'),
  S('sargas', 'Sargas', 'sco', 17.622, -43.0, 1.86, null, 'F'),
  S('kappa-sco', 'κ Scorpii', 'sco', 17.708, -39.03, 2.4, null, 'B'),
  S('shaula', 'Shaula', 'sco', 17.56, -37.1, 1.62, null, 'B', 'El aguijón del escorpión.'),
  S('lesath', 'Lesath', 'sco', 17.513, -37.3, 2.7, null, 'B'),
  // Sagitario (la Tetera)
  S('kaus-australis', 'Kaus Australis', 'sgr', 18.403, -34.38, 1.85, 143, 'B'),
  S('nunki', 'Nunki', 'sgr', 18.921, -26.3, 2.05, 228, 'B'),
  S('kaus-media', 'Kaus Media', 'sgr', 18.35, -29.83, 2.7, null, 'K'),
  S('kaus-borealis', 'Kaus Borealis', 'sgr', 18.466, -25.42, 2.8, 78, 'K'),
  S('ascella', 'Ascella', 'sgr', 19.043, -29.88, 2.6, 88, 'A'),
  S('phi-sgr', 'φ Sagittarii', 'sgr', 18.761, -26.99, 3.2, null, 'B'),
  S('alnasl', 'Alnasl', 'sgr', 18.097, -30.42, 2.99, 97, 'K', 'El pico de la tetera: apunta hacia el centro de la Vía Láctea.'),
  S('tau-sgr', 'τ Sagittarii', 'sgr', 19.116, -27.67, 3.3, null, 'K'),
  // Leo
  S('regulus', 'Régulo', 'leo', 10.14, 11.97, 1.35, 79, 'B', 'Está casi sobre la eclíptica: la Luna la oculta a veces.'),
  S('denebola', 'Denébola', 'leo', 11.818, 14.57, 2.13, 36, 'A', 'La cola del león.'),
  S('algieba', 'Algieba', 'leo', 10.333, 19.84, 2.0, 130, 'K'),
  S('zosma', 'Zosma', 'leo', 11.235, 20.52, 2.56, 58, 'A'),
  S('chertan', 'Chertan', 'leo', 11.237, 15.43, 3.3, null, 'A'),
  S('eta-leo', 'η Leonis', 'leo', 10.122, 16.76, 3.5, null, 'A'),
  S('adhafera', 'Adhafera', 'leo', 10.278, 23.42, 3.4, null, 'F'),
  S('rasalas', 'Rasalas', 'leo', 9.879, 26.01, 3.9, null, 'K'),
  S('algenubi', 'Algenubi', 'leo', 9.764, 23.77, 2.98, null, 'G'),
  // Boyero
  S('arcturus', 'Arturo', 'boo', 14.261, 19.18, -0.05, 36.7, 'K', 'La estrella más brillante del hemisferio norte celeste.'),
  S('izar', 'Izar', 'boo', 14.75, 27.07, 2.35, null, 'K'),
  S('muphrid', 'Muphrid', 'boo', 13.911, 18.4, 2.68, 37, 'G'),
  S('seginus', 'Seginus', 'boo', 14.535, 38.31, 3.0, 87, 'A'),
  S('nekkar', 'Nekkar', 'boo', 15.032, 40.39, 3.5, null, 'G'),
  S('delta-boo', 'δ Boötis', 'boo', 15.258, 33.31, 3.5, null, 'G'),
  S('rho-boo', 'ρ Boötis', 'boo', 14.531, 30.37, 3.6, null, 'K'),
  // Virgo
  S('spica', 'Espiga', 'vir', 13.42, -11.16, 0.98, 250, 'B', 'Dos estrellas tan juntas que se deforman mutuamente.'),
  S('porrima', 'Porrima', 'vir', 12.694, -1.45, 2.7, 38, 'F'),
  S('vindemiatrix', 'Vindemiatrix', 'vir', 13.036, 10.96, 2.8, 110, 'G'),
  S('minelauva', 'Minelauva', 'vir', 12.927, 3.4, 3.4, null, 'M'),
  S('heze', 'Heze', 'vir', 13.578, -0.6, 3.4, 74, 'A'),
  S('zavijava', 'Zavijava', 'vir', 11.845, 1.76, 3.6, 36, 'F'),
  S('zaniah', 'Zaniah', 'vir', 12.332, -0.67, 3.9, null, 'A'),
  // Cruz del Sur y Centauro
  S('acrux', 'Ácrux', 'cru', 12.443, -63.1, 0.77, 320, 'B', 'El pie de la Cruz del Sur, la constelación más pequeña de las 88.'),
  S('mimosa', 'Mimosa', 'cru', 12.795, -59.69, 1.25, 280, 'B'),
  S('gacrux', 'Gácrux', 'cru', 12.519, -57.11, 1.63, 88, 'M'),
  S('imai', 'Imai', 'cru', 12.252, -58.75, 2.8, null, 'B'),
  S('rigil-kent', 'Alfa Centauri', 'cen', 14.66, -60.83, -0.27, 4.37, 'G', 'El sistema estelar más cercano al Sol.'),
  S('hadar', 'Hadar', 'cen', 14.064, -60.37, 0.61, 390, 'B'),
  // Pegaso y Andrómeda
  S('markab', 'Markab', 'peg', 23.079, 15.21, 2.48, 140, 'B'),
  S('scheat', 'Scheat', 'peg', 23.063, 28.08, 2.42, 200, 'M'),
  S('algenib', 'Algenib', 'peg', 0.22, 15.18, 2.83, null, 'B'),
  S('enif', 'Enif', 'peg', 21.736, 9.88, 2.4, null, 'K', 'La nariz del caballo alado.'),
  S('homam', 'Homam', 'peg', 22.691, 10.83, 3.4, null, 'B'),
  S('biham', 'Biham', 'peg', 22.17, 6.2, 3.5, null, 'A'),
  S('alpheratz', 'Alpheratz', 'and', 0.14, 29.09, 2.06, 97, 'B', 'Comparte vértice entre Andrómeda y el Cuadrado de Pegaso.'),
  S('mirach', 'Mirach', 'and', 1.162, 35.62, 2.05, 200, 'M', 'Desde Mirach, subiendo dos estrellas, se llega a la galaxia de Andrómeda.'),
  S('almach', 'Almach', 'and', 2.065, 42.33, 2.1, 350, 'K'),
  S('delta-and', 'δ Andromedae', 'and', 0.655, 30.86, 3.27, 100, 'K'),
  // Estrellas brillantes sin figura aquí
  S('canopus', 'Canopo', null, 6.399, -52.7, -0.74, 310, 'F', 'La segunda estrella más brillante del cielo nocturno.'),
  S('achernar', 'Achernar', null, 1.629, -57.24, 0.46, 139, 'B', 'Una de las estrellas más achatadas conocidas, por su rápida rotación.'),
  S('fomalhaut', 'Fomalhaut', null, 22.961, -29.62, 1.16, 25, 'A', 'Tiene un anillo de polvo, como un sistema planetario joven.'),
]);

/** Constelaciones con figura. `hint`: pista para encontrarla desde algo conocido. */
export const CONSTELLATIONS = Object.freeze([
  { id: 'ori', name: 'Orión', blurb: 'El cazador. Su cinturón son tres estrellas casi alineadas.', hint: 'Busca tres estrellas en fila cerca del ecuador celeste, a las 5 h y media.', lines: [['betelgeuse', 'bellatrix'], ['betelgeuse', 'alnitak'], ['bellatrix', 'mintaka'], ['mintaka', 'alnilam'], ['alnilam', 'alnitak'], ['alnitak', 'saiph'], ['mintaka', 'rigel']] },
  { id: 'cma', name: 'Can Mayor', blurb: 'El perro del cazador, con Sirio en el hocico.', hint: 'Sigue el cinturón de Orión hacia abajo y a la izquierda: llegarás a la estrella más brillante.', lines: [['sirio', 'mirzam'], ['sirio', 'wezen'], ['wezen', 'adhara'], ['wezen', 'aludra'], ['adhara', 'furud']] },
  { id: 'cmi', name: 'Can Menor', blurb: 'Solo dos estrellas, pero una es Proción, de las más cercanas.', hint: 'Al este de Orión, a la altura de Betelgeuse.', lines: [['procyon', 'gomeisa']] },
  { id: 'tau', name: 'Tauro', blurb: 'El toro, con Aldebarán como ojo y las Pléyades sobre el lomo.', hint: 'Sigue el cinturón de Orión hacia arriba y a la derecha: una estrella naranja.', lines: [['aldebaran', 'ain'], ['ain', 'elnath'], ['aldebaran', 'hyadum'], ['aldebaran', 'tianguan']] },
  { id: 'gem', name: 'Géminis', blurb: 'Los gemelos Cástor y Pólux, de la mano.', hint: 'Dos estrellas brillantes juntas, al noreste de Orión.', lines: [['castor', 'mebsuta'], ['mebsuta', 'tejat'], ['pollux', 'wasat'], ['wasat', 'alhena'], ['castor', 'pollux']] },
  { id: 'aur', name: 'Auriga', blurb: 'El cochero: un pentágono con la amarilla Capella.', hint: 'Por encima de Orión y Tauro, muy al norte: un pentágono.', lines: [['capella', 'menkalinan'], ['menkalinan', 'mahasim'], ['mahasim', 'elnath'], ['elnath', 'hassaleh'], ['hassaleh', 'almaaz'], ['almaaz', 'capella']] },
  { id: 'uma', name: 'Osa Mayor', blurb: 'Su parte más famosa es el Carro: siete estrellas brillantes.', hint: 'Cerca del polo norte, hacia las 11-13 h: un cazo de siete estrellas.', lines: [['dubhe', 'merak'], ['merak', 'phecda'], ['phecda', 'megrez'], ['megrez', 'dubhe'], ['megrez', 'alioth'], ['alioth', 'mizar'], ['mizar', 'alkaid']] },
  { id: 'umi', name: 'Osa Menor', blurb: 'El Carro pequeño; la Polar es la punta de su cola.', hint: 'Sube hasta el polo norte celeste (declinación +90°).', lines: [['polaris', 'yildun'], ['yildun', 'urodelus'], ['urodelus', 'akhfa'], ['akhfa', 'kochab'], ['kochab', 'pherkad'], ['pherkad', 'anwar'], ['anwar', 'akhfa']] },
  { id: 'cas', name: 'Casiopea', blurb: 'La reina, con forma de «W» (o de «M», según la hora).', hint: 'Al otro lado de la Polar respecto al Carro, hacia la 1 h.', lines: [['caph', 'schedar'], ['schedar', 'navi'], ['navi', 'ruchbah'], ['ruchbah', 'segin']] },
  { id: 'cyg', name: 'Cisne', blurb: 'Una gran cruz que vuela a lo largo de la Vía Láctea.', hint: 'Hacia las 20 h y +40°, sobre la Vía Láctea.', lines: [['deneb', 'sadr'], ['sadr', 'albireo'], ['gienah', 'sadr'], ['sadr', 'fawaris']] },
  { id: 'lyr', name: 'Lira', blurb: 'Pequeña, con Vega, una de las más brillantes.', hint: 'Junto al Cisne, al oeste de Deneb: una estrella blanca muy brillante.', lines: [['vega', 'zeta-lyr'], ['zeta-lyr', 'sheliak'], ['sheliak', 'sulafat'], ['sulafat', 'delta-lyr'], ['delta-lyr', 'zeta-lyr']] },
  { id: 'aql', name: 'Águila', blurb: 'Altair y sus dos escoltas forman el cuerpo del águila.', hint: 'Al sur del Cisne, cerca del ecuador, hacia las 20 h.', lines: [['tarazed', 'altair'], ['altair', 'alshain'], ['altair', 'delta-aql'], ['delta-aql', 'lambda-aql'], ['tarazed', 'okab']] },
  { id: 'sco', name: 'Escorpio', blurb: 'Un escorpión con el corazón rojo de Antares.', hint: 'Al sur, hacia las 16-17 h: una larga cola curvada.', lines: [['acrab', 'dschubba'], ['dschubba', 'fang'], ['dschubba', 'alniyat'], ['alniyat', 'antares'], ['antares', 'paikauhale'], ['paikauhale', 'larawag'], ['larawag', 'xamidimura'], ['xamidimura', 'zeta-sco'], ['zeta-sco', 'eta-sco'], ['eta-sco', 'sargas'], ['sargas', 'kappa-sco'], ['kappa-sco', 'lesath'], ['lesath', 'shaula']] },
  { id: 'sgr', name: 'Sagitario', blurb: 'El arquero, cuyas estrellas forman una tetera.', hint: 'Al este de Escorpio, hacia las 18-19 h: una tetera.', lines: [['alnasl', 'kaus-media'], ['kaus-media', 'kaus-australis'], ['kaus-australis', 'alnasl'], ['kaus-media', 'kaus-borealis'], ['kaus-borealis', 'phi-sgr'], ['phi-sgr', 'kaus-media'], ['phi-sgr', 'nunki'], ['nunki', 'tau-sgr'], ['tau-sgr', 'ascella'], ['ascella', 'phi-sgr'], ['ascella', 'kaus-australis']] },
  { id: 'leo', name: 'Leo', blurb: 'El león: una hoz invertida (la melena) y un triángulo (la cola).', hint: 'Hacia las 10-11 h, al norte del ecuador: un signo de interrogación al revés.', lines: [['regulus', 'eta-leo'], ['eta-leo', 'algieba'], ['algieba', 'adhafera'], ['adhafera', 'rasalas'], ['rasalas', 'algenubi'], ['algieba', 'zosma'], ['zosma', 'denebola'], ['denebola', 'chertan'], ['chertan', 'regulus'], ['zosma', 'chertan']] },
  { id: 'boo', name: 'Boyero', blurb: 'Una cometa con Arturo en la punta.', hint: 'Prolonga la curva del mango del Carro y «arquéate hacia Arturo».', lines: [['arcturus', 'izar'], ['izar', 'delta-boo'], ['delta-boo', 'nekkar'], ['nekkar', 'seginus'], ['seginus', 'rho-boo'], ['rho-boo', 'arcturus'], ['arcturus', 'muphrid']] },
  { id: 'vir', name: 'Virgo', blurb: 'La doncella, con la azulada Espiga.', hint: 'Sigue la curva del Carro más allá de Arturo: «acelera hacia Espiga».', lines: [['spica', 'porrima'], ['porrima', 'zaniah'], ['zaniah', 'zavijava'], ['porrima', 'minelauva'], ['minelauva', 'vindemiatrix'], ['minelauva', 'heze'], ['heze', 'spica']] },
  { id: 'cru', name: 'Cruz del Sur', blurb: 'La más pequeña de las 88 constelaciones, guía del sur.', hint: 'Muy al sur (−60°), hacia las 12 h y media.', lines: [['acrux', 'gacrux'], ['mimosa', 'imai']] },
  { id: 'cen', name: 'Centauro', blurb: 'Aquí solo sus dos punteros, que señalan la Cruz del Sur.', hint: 'Junto a la Cruz del Sur, hacia las 14 h: dos estrellas brillantes.', lines: [['rigil-kent', 'hadar']] },
  { id: 'peg', name: 'Pegaso', blurb: 'El caballo alado; su cuerpo es un gran cuadrado.', hint: 'Hacia las 23 h-0 h: un cuadrado enorme sin casi nada dentro.', lines: [['markab', 'scheat'], ['scheat', 'alpheratz'], ['alpheratz', 'algenib'], ['algenib', 'markab'], ['markab', 'homam'], ['homam', 'biham'], ['biham', 'enif']] },
  { id: 'and', name: 'Andrómeda', blurb: 'La princesa encadenada; guarda la galaxia más lejana visible a simple vista.', hint: 'Sale de una esquina del Cuadrado de Pegaso hacia Casiopea.', lines: [['alpheratz', 'delta-and'], ['delta-and', 'mirach'], ['mirach', 'almach']] },
]);

/** Objetos de cielo profundo. */
export const DEEP_SKY = Object.freeze([
  { id: 'm31', name: 'Galaxia de Andrómeda', short: 'M31', type: 'galaxy', ra: 0.712, dec: 41.27, mag: 3.4, dist: 2_500_000, size: 3.2, angle: 35, note: 'La galaxia grande más cercana. Su luz salió hace unos 2,5 millones de años; a simple vista es una mancha alargada.', kind: 'dso' },
  { id: 'm42', name: 'Nebulosa de Orión', short: 'M42', type: 'nebula', ra: 5.588, dec: -5.39, mag: 4.0, dist: 1340, size: 1.1, note: 'Una guardería de estrellas en la espada de Orión, visible a simple vista.', kind: 'dso' },
  { id: 'm45', name: 'Pléyades', short: 'M45', type: 'cluster', ra: 3.79, dec: 24.12, mag: 1.6, dist: 440, size: 1.6, note: 'Un cúmulo de estrellas jóvenes. A simple vista se cuentan 6 o 7.', kind: 'dso' },
]);

export const TYPE_LABELS = Object.freeze({ galaxy: 'Galaxia', nebula: 'Nebulosa', cluster: 'Cúmulo abierto', star: 'Estrella', asterism: 'Asterismo personal' });

export const SPECTRAL = Object.freeze({
  O: { color: '#9bb0ff', label: 'azul (tipo O)' },
  B: { color: '#aabfff', label: 'blanco azulado (tipo B)' },
  A: { color: '#cad7ff', label: 'blanco (tipo A)' },
  F: { color: '#f8f7ff', label: 'blanco amarillento (tipo F)' },
  G: { color: '#fff4ea', label: 'amarillo (tipo G, como el Sol)' },
  K: { color: '#ffd2a1', label: 'naranja (tipo K)' },
  M: { color: '#ffb07a', label: 'rojo (tipo M)' },
});

export const starById = new Map(STARS.map((s) => [s.id, s]));
export const constellationById = new Map(CONSTELLATIONS.map((c) => [c.id, c]));
