---
id: entropia
title: Por qué el café se enfría
category: cosmos
path: leyes
order: 8
difficulty: avanzado
description: Un ingeniero francés que quiso mejorar las máquinas de vapor, un austriaco con una fórmula grabada en su tumba y un diablillo imaginario capaz de ordenar moléculas. La termodinámica, la entropía y la extraña dirección del tiempo.
keywords: termodinámica, calor, temperatura, Carnot, máquina térmica, rendimiento, Clausius, entropía, segunda ley, Kelvin, cero absoluto, Boltzmann, microestados, probabilidad, flecha del tiempo, irreversibilidad, demonio de Maxwell, Szilard, Landauer, información, Shannon, vida, Schrödinger, muerte térmica
related: movimiento-y-energia, big-bang, materia-y-energia-oscura, limites-del-conocimiento
---

Si dejas una taza de café caliente sobre la mesa, al cabo de un rato estará tibia, y después fría, a la misma temperatura que la habitación. Nunca has visto, ni verás, que una taza de café a temperatura ambiente se caliente sola, tomando calor del aire de la habitación. Si echas una gota de leche en el café, se mezcla y forma un color uniforme; nunca verás que la leche se separe espontáneamente y vuelva a formar una gota. Si dejas caer un vaso, se rompe; nunca verás que los fragmentos salten del suelo y se recompongan.

Todo esto parece tan obvio que no pensamos en ello. Pero esconde uno de los misterios más profundos de la física. Las leyes fundamentales que gobiernan las partículas, las de Newton, las de Maxwell, incluso las de la física cuántica en su mayor parte, funcionan igual hacia delante y hacia atrás en el tiempo. Si filmas el choque de dos bolas de billar y proyectas la película al revés, lo que ves también es un choque perfectamente posible. Y sin embargo, el mundo que vemos tiene una dirección clara: el café se enfría, la leche se mezcla, los vasos se rompen, las personas envejecen.

La ciencia que explica esa dirección se llama **termodinámica**, y su concepto central, la **entropía**, es una de las ideas más poderosas y peor comprendidas de toda la física.

## El ingeniero que pensaba en el fuego

A comienzos del siglo XIX, la máquina de vapor estaba transformando el mundo. Movía bombas en las minas, telares en las fábricas y, pronto, locomotoras y barcos. Pero nadie sabía con claridad qué limitaba su rendimiento. ¿Se podía construir una máquina que aprovechara toda la energía del carbón? ¿Importaba usar vapor, aire o alcohol?

En 1824, un joven ingeniero militar francés llamado Sadi Carnot publicó un pequeño libro titulado *Reflexiones sobre la potencia motriz del fuego*. Carnot todavía creía que el calor era un fluido, el calórico, una idea que como vimos resultaría equivocada. Pero llegó a una conclusión correcta y profunda: una máquina térmica produce trabajo aprovechando el paso de calor desde un cuerpo caliente a uno frío, igual que una rueda hidráulica aprovecha la caída del agua desde un nivel alto a uno bajo. Y el rendimiento máximo posible depende solo de las temperaturas del foco caliente y del frío, no de la sustancia que se use.

:::analogia
Una rueda de molino obtiene trabajo del agua que cae de una altura a otra. Cuanto mayor es el desnivel, más trabajo puede obtener. Pero si todo el agua está ya en el nivel más bajo, por mucha agua que haya, no puede mover nada. Con el calor ocurre algo parecido: lo que produce trabajo no es la cantidad de calor, sino la diferencia de temperatura. Un océano tibio contiene una cantidad enorme de energía, pero no puede mover un motor si no hay algo más frío a donde llevarla.
:::

Carnot murió en 1832, a los treinta y seis años, durante una epidemia de cólera. Su libro pasó casi inadvertido hasta que otros físicos lo rescataron años después.

## Las leyes de la termodinámica

A mediados del siglo XIX, sobre la base de las ideas de Carnot y de los experimentos de Joule que vimos en el capítulo sobre la energía, los físicos alemán Rudolf Clausius y británico William Thomson, más tarde lord Kelvin, formularon las leyes de la termodinámica. Hoy suelen enunciarse así:

- **Ley cero**: si dos cuerpos están cada uno en equilibrio térmico con un tercero, están en equilibrio entre sí. Es lo que permite que exista algo como un termómetro.
- **Primera ley**: la energía se conserva. El calor es una forma de energía, y la energía total de un sistema aislado no cambia. No se puede obtener trabajo de la nada.
- **Segunda ley**: el calor fluye espontáneamente de los cuerpos calientes a los fríos, y nunca al revés sin un aporte de trabajo. Ninguna máquina puede convertir todo el calor en trabajo. En términos más generales, la **entropía** de un sistema aislado nunca disminuye.
- **Tercera ley**: es imposible alcanzar el cero absoluto de temperatura, unos −273,15 grados Celsius, en un número finito de pasos.

A veces se resumen, con humor, en un juego de apuestas: no puedes ganar, por la primera ley; ni siquiera puedes empatar, por la segunda; y ni siquiera puedes abandonar el juego, por la tercera.

## Una palabra nueva

En 1865, Clausius buscaba un nombre para una magnitud que aparecía una y otra vez en sus cálculos: una medida de cuánta energía de un sistema ya no está disponible para producir trabajo. Eligió una palabra derivada del griego *tropé*, transformación, y la hizo parecida a «energía» a propósito, porque pensaba que ambos conceptos estaban emparentados. La llamó **entropía**.

Clausius resumió las dos primeras leyes en dos frases célebres: la energía del universo es constante; la entropía del universo tiende a un máximo.

Pero ¿qué es, en el fondo, la entropía? La definición de Clausius era abstracta, basada en cantidades de calor y temperaturas. La respuesta más profunda llegaría de alguien que se tomó en serio que la materia está hecha de átomos.

## La fórmula de la tumba

En el cementerio central de Viena hay una tumba con un busto de mármol y, encima, una fórmula: S = k log W. Es la tumba del físico austriaco Ludwig Boltzmann, y la fórmula resume el trabajo de su vida.

Boltzmann partió de una idea sencilla. Un gas, por ejemplo, está formado por una cantidad inmensa de moléculas que se mueven y chocan. Su estado visible, lo que medimos con un termómetro o un manómetro, como la temperatura, la presión o el volumen, se llama **macroestado**. Pero ese mismo macroestado puede corresponder a una cantidad astronómica de configuraciones distintas de las moléculas: cuál está dónde y con qué velocidad. Cada una de esas configuraciones es un **microestado**.

La fórmula de Boltzmann dice que la entropía de un macroestado está relacionada con el número de microestados que lo producen. Un estado de alta entropía es simplemente uno que puede realizarse de muchísimas maneras distintas; uno de baja entropía, uno que solo puede realizarse de pocas maneras.

:::analogia
Imagina una baraja de cartas recién comprada, ordenada por palos y números. Solo hay una manera de que esté exactamente así. Ahora barájala. Hay una cantidad inimaginable de órdenes posibles que llamarías «desordenados», y muy pocos que llamarías «ordenados». Si barajas al azar, casi con total seguridad obtendrás uno desordenado, no porque el desorden tenga una fuerza especial, sino porque hay muchísimos más. Y si sigues barajando, es prácticamente imposible que vuelvas a la baraja ordenada.
:::

Con esta idea, la segunda ley deja de ser un misterio para convertirse en estadística. Los sistemas evolucionan hacia estados de mayor entropía simplemente porque hay muchísimos más de esos estados que de los otros. La leche se mezcla con el café porque hay infinitamente más maneras de tener las moléculas de leche repartidas por toda la taza que de tenerlas todas juntas en una gota. No es imposible que se separen espontáneamente: es tan improbable que no ocurriría ni aunque esperaras muchas veces la edad del universo.

## Una ley diferente

La segunda ley de la termodinámica tiene un carácter distinto del de otras leyes de la física. No dice que algo sea imposible, sino que es abrumadoramente improbable. Para sistemas con pocas partículas, se pueden observar fluctuaciones en las que la entropía disminuye momentáneamente; experimentos con partículas microscópicas lo han comprobado. Pero para cualquier objeto de tamaño cotidiano, con billones de billones de moléculas, la probabilidad de que la entropía disminuya apreciablemente es tan pequeña que, a efectos prácticos, la ley es absoluta.

El astrofísico Arthur Eddington, al que conocimos en el capítulo sobre la relatividad general, consideraba que la segunda ley ocupa la posición suprema entre las leyes de la naturaleza. Escribió, en esencia, que si alguien presentaba una teoría que contradecía las ecuaciones de Maxwell, quizá las ecuaciones de Maxwell estuvieran mal; pero si contradecía la segunda ley de la termodinámica, no había ninguna esperanza para ella.

Boltzmann no vivió para ver el triunfo de sus ideas. Muchos físicos de su tiempo, influidos por corrientes que rechazaban la existencia real de los átomos, atacaron duramente su trabajo. Sufría depresiones, y en 1906, durante unas vacaciones en Duino, cerca de Trieste, se quitó la vida. Pocos años después, los experimentos de Perrin sobre el movimiento browniano confirmaron la existencia de los átomos y le dieron la razón.

## La flecha del tiempo

En 1927, Eddington acuñó una expresión para la dirección del tiempo que marca el aumento de la entropía: la **flecha del tiempo**. La entropía nos dice qué es el pasado y qué es el futuro. Recordamos el pasado y no el futuro, envejecemos y no rejuvenecemos, las estrellas se apagan y no se encienden solas, porque el universo evoluciona de estados de menor entropía a estados de mayor entropía.

Pero esa explicación plantea una pregunta incómoda. Si las leyes fundamentales son simétricas en el tiempo, y la entropía aumenta simplemente porque los estados de alta entropía son más probables, ¿por qué el pasado tenía menos entropía que el presente? Lo más probable, siguiendo el mismo razonamiento, sería que el universo hubiera tenido siempre una entropía altísima.

La respuesta más aceptada es que el universo empezó en un estado de entropía extraordinariamente baja, en el Big Bang. Toda la flecha del tiempo que vivimos sería la consecuencia de ese punto de partida tan especial, del que el universo se va alejando. Algunos filósofos de la física llaman a esta suposición la **hipótesis del pasado**.

:::incierto ¿Por qué empezó tan ordenado?
Puede parecer extraño hablar de baja entropía para el universo primitivo, que era una sopa caliente y casi uniforme. La clave está en la gravedad: para un sistema dominado por la gravedad, la uniformidad es un estado de baja entropía, porque la materia tiende a agruparse en estrellas, galaxias y agujeros negros, liberando calor. Por qué el universo empezó en un estado tan uniforme y tan improbable es una de las grandes preguntas abiertas de la cosmología. Algunas teorías, como la inflación, intentan explicarlo; otras proponen que nuestro universo es una fluctuación dentro de algo mayor. Ninguna respuesta es todavía definitiva.
:::

## El demonio de Maxwell

En 1867, James Clerk Maxwell, el mismo de las ecuaciones de la luz, imaginó un experimento mental que parecía romper la segunda ley. Supón un recipiente con gas dividido en dos mitades por una pared con una pequeña compuerta. Junto a la compuerta hay un ser diminuto, capaz de ver cada molécula. Cuando una molécula rápida se acerca desde la izquierda, abre la compuerta y la deja pasar a la derecha; cuando una lenta se acerca desde la derecha, la deja pasar a la izquierda. Con el tiempo, el lado derecho se calentará y el izquierdo se enfriará, sin ningún trabajo aparente. La entropía habría disminuido. Otro físico, William Thomson, bautizó a ese ser como el **demonio de Maxwell**.

Durante décadas, los físicos discutieron dónde estaba el truco. En 1929, el físico húngaro Leó Szilárd sugirió que el demonio, para hacer su trabajo, necesita adquirir información sobre las moléculas, y que eso tiene un coste. En 1961, el físico Rolf Landauer, que trabajaba en IBM, precisó la idea: lo que tiene un coste inevitable no es tanto medir como **borrar** información. Para seguir trabajando, el demonio tiene que olvidar lo que sabía de las moléculas anteriores, y borrar un solo bit de información disipa una cantidad mínima de calor y aumenta la entropía del entorno. Al hacer bien las cuentas, la entropía total nunca disminuye.

:::dato
El principio de Landauer, según el cual borrar información disipa inevitablemente una cantidad mínima de calor, se comprobó experimentalmente en 2012 con una pequeña partícula atrapada por láseres, en un estudio publicado en la revista *Nature*. La cantidad de calor es minúscula, muy inferior a la que disipan los ordenadores actuales por otros motivos, pero establece un límite físico fundamental a la eficiencia de cualquier computación.
:::

El demonio de Maxwell reveló algo profundo: la entropía y la **información** están relacionadas. En 1948, el ingeniero y matemático estadounidense Claude Shannon, al fundar la teoría de la información, definió una medida de la incertidumbre de un mensaje que tenía exactamente la misma forma matemática que la entropía de Boltzmann. Según una anécdota contada por el propio Shannon, fue el matemático John von Neumann quien le sugirió llamarla entropía, entre otras razones porque, en una discusión, nadie sabe realmente qué es la entropía, así que siempre tendría ventaja.

## ¿Contradice la vida la segunda ley?

Un argumento que aparece a veces contra la evolución biológica dice que los seres vivos son estructuras muy ordenadas, y que su aparición y desarrollo contradicen la segunda ley de la termodinámica, que exige que el desorden aumente.

El argumento es erróneo. La segunda ley se aplica a sistemas aislados, que no intercambian energía con el exterior. Un ser vivo no es un sistema aislado: recibe energía, en forma de alimentos o de luz solar, y devuelve al entorno calor y desechos con mucha más entropía. Puede mantener o aumentar su orden interno a costa de aumentar todavía más el desorden de su entorno. La entropía total, la del ser vivo más la de su entorno, siempre aumenta.

En 1944, Erwin Schrödinger, el de la ecuación y el gato, publicó un pequeño libro titulado *¿Qué es la vida?*, en el que analizaba la vida desde la física. Explicaba que los organismos se mantienen vivos extrayendo orden de su entorno, una idea que inspiró a varios de los científicos que después descubrirían la estructura del ADN.

La Tierra en su conjunto funciona del mismo modo. Recibe del Sol una luz de alta energía, concentrada en pocos fotones visibles, y devuelve al espacio la misma energía en forma de muchos más fotones infrarrojos de baja energía, con mucha más entropía. Ese flujo es el que alimenta la fotosíntesis, el clima, la vida y, en último término, a ti.

:::analogia
Un frigorífico enfría su interior, lo que podría parecer una disminución de la entropía. Pero para hacerlo consume electricidad y expulsa calor por la parte trasera, que está siempre caliente. Si sumas el interior frío y la cocina calentada, la entropía total ha aumentado. La vida funciona como un frigorífico muy sofisticado: crea orden dentro a costa de crear más desorden fuera.
:::

## El destino final

Si la entropía del universo aumenta siempre, ¿qué ocurrirá al final? En el siglo XIX, Kelvin y otros imaginaron una **muerte térmica** del universo: un estado en el que todo habría alcanzado la misma temperatura, sin diferencias que aprovechar, sin posibilidad de producir trabajo, sin procesos, sin vida. Un universo en equilibrio perfecto, donde nada vuelve a ocurrir.

Como vimos en el capítulo sobre la energía oscura, la cosmología moderna apunta, si la expansión acelerada continúa para siempre, a un destino parecido: estrellas apagadas, galaxias alejadas más allá del horizonte, agujeros negros que se evaporan lentamente por la radiación de Hawking en tiempos inimaginables y un universo cada vez más frío y vacío. Es un futuro tan lejano que los números pierden sentido, pero la segunda ley lo señala con paciencia.

## Epílogo: la taza en la mesa

La próxima vez que veas enfriarse una taza de café, piensa que estás viendo la segunda ley de la termodinámica en acción: billones de moléculas del café chocando con las del aire y la taza, repartiendo su energía, avanzando hacia el estado de mayor número de configuraciones posibles. Estás viendo, de algún modo, la flecha del tiempo.

Sadi Carnot quería mejorar las máquinas de vapor. Clausius dio nombre a una magnitud extraña. Boltzmann la explicó con átomos y probabilidades y pagó un precio terrible por defender una idea que el tiempo le daría por buena. Maxwell imaginó un demonio que, más de un siglo después, ayudó a entender que la información es física. Todos ellos contribuyeron a responder una pregunta que parece infantil y es abismal: ¿por qué el tiempo solo va hacia delante?

En el próximo capítulo daremos un paso atrás para mirar algo que hemos usado en todo este estante sin detenernos en ello: las unidades, las escalas y los órdenes de magnitud que permiten pensar a la vez en un protón y en una galaxia.

## Conceptos importantes

- **Termodinámica**: rama de la física que estudia el calor, el trabajo, la energía y la entropía.
- **Máquina térmica**: dispositivo que produce trabajo aprovechando el flujo de calor entre un foco caliente y uno frío.
- **Segunda ley de la termodinámica**: la entropía de un sistema aislado nunca disminuye; el calor fluye espontáneamente de lo caliente a lo frío.
- **Entropía**: medida del número de configuraciones microscópicas compatibles con el estado visible de un sistema; relacionada con la energía no disponible para hacer trabajo.
- **Microestado y macroestado**: configuración detallada de todas las partículas frente al estado observable que comparten muchas configuraciones.
- **Cero absoluto**: temperatura mínima teórica, −273,15 grados Celsius, inalcanzable en la práctica.
- **Flecha del tiempo**: dirección del tiempo definida por el aumento de la entropía.
- **Demonio de Maxwell**: ser imaginario que parecía violar la segunda ley seleccionando moléculas; su análisis vinculó entropía e información.
- **Principio de Landauer**: borrar un bit de información disipa una cantidad mínima de calor.
- **Muerte térmica**: posible estado final de un universo en equilibrio, sin diferencias de temperatura que permitan procesos.

## Fuentes y lecturas

- Sadi Carnot, *Reflexiones sobre la potencia motriz del fuego* (1824; existen varias ediciones modernas y traducciones).
- Peter Atkins, *Las cuatro leyes del universo* (Espasa, 2008).
- Sean Carroll, *From Eternity to Here: The Quest for the Ultimate Theory of Time* (Dutton, 2010).
- Erwin Schrödinger, *¿Qué es la vida?* (Tusquets, varias ediciones; original de 1944).
- Antoine Bérut y otros, «Experimental verification of Landauer's principle linking information and thermodynamics», *Nature* 483 (2012).
- Carlo Rovelli, *El orden del tiempo* (Anagrama, 2018).
