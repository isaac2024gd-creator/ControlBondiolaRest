/* Menú de personal Bondiola – ciclo por ingrediente. Versión 2026-10-28r.
   Ingredientes con los nombres, subrecetas y precios del Recetario costeado (28 oct 2026, con rendimiento).
   Formato de cada preparación: [nombre, preparación, "Insumo:cantidad:unidad|...", costo por persona] */
const CICLO = {
  version: "2026-10-28r",
  inicio: "2026-11-02",
  cafe: { insumo: "Café americano (grano)", cantidad: 12, unidad: "g", costo: 4.8 },
  topes: { desayuno: 10, comida: 22, dia: 32 },
  presupuesto: { min: 30, max: 35 },
  comida: [
    ["Huevo", [
      ["Huevos rancheros con frijol", "Freír tortilla ligeramente, huevo estrellado encima, bañar con salsa roja (jitomate, cebolla y serrano licuados y fritos). Frijoles de la olla aparte.", "Huevo:2:pza|Tortilla de maíz:2:pza|Jitomate saladet:80:g|Cebolla:15:g|Chile serrano:5:g|Frijol refrito:45:g|Aceite:10:ml", 11.77],
      ["Huevo a la mexicana con arroz y frijol", "Sofreír jitomate, cebolla y chile picados; agregar huevo y revolver. Servir con arroz blanco y frijoles.", "Huevo:2:pza|Jitomate saladet:50:g|Cebolla:20:g|Chile serrano:5:g|Arroz:50:g|Frijol refrito:40:g|Tortilla de maíz:2:pza|Aceite:10:ml", 12.03],
      ["Tortitas de papa con huevo en salsa verde", "Cocer y machacar la papa, mezclar con huevo y cebolla, formar tortitas y freír. Bañar con salsa verde cocida.", "Huevo:1:pza|Papa blanca:150:g|Cebolla:15:g|Frijol refrito:40:g|Aceite:20:ml|Salsa verde:120:ml", 10.82],
      ["Chilaquiles verdes con huevo", "Calentar la salsa verde de DÍA, agregar los totopos y dar un hervor de 1–2 min; huevo estrellado o revuelto encima, crema y panela.", "Totopos:0.75:porción|Salsa verde:200:ml|Huevo:1:pza|Crema:20:g|Queso panela:20:g", 14.53]]],
    ["Pollo", [
      ["Tostadas de tinga de pollo", "Cocer y deshebrar pollo. Sofreír cebolla en rodajas, agregar jitomate y chipotle licuados y el pollo. Tostada con frijol, tinga, lechuga y crema.", "Pollo limpio:85:g|Jitomate saladet:60:g|Cebolla:40:g|Chipotle (lata):8:g|Tostada:3:pza|Frijol refrito:40:g|Crema:15:g|Mezcla de lechugas:20:g", 20.38],
      ["Pollo en salsa verde con arroz", "Pollo en trozos cocido 10 min en la salsa verde de DÍA. Arroz blanco y tortillas.", "Pollo limpio:100:g|Arroz:60:g|Tortilla de maíz:2:pza|Salsa verde:150:ml", 17.33],
      ["Enchiladas rojas de pollo", "Pasar tortillas por aceite y salsa roja, rellenar con pollo deshebrado, enrollar; crema, panela y lechuga.", "Pollo limpio:80:g|Tortilla de maíz:3:pza|Jitomate saladet:80:g|Chile serrano:5:g|Cebolla:15:g|Crema:20:g|Queso panela:20:g|Mezcla de lechugas:20:g|Aceite:15:ml", 21.1],
      ["Pollo a la mexicana con papa", "Pollo en cubos dorado; agregar papa en cubos precocida, jitomate, cebolla y chile. Tortillas.", "Pollo limpio:100:g|Papa blanca:120:g|Jitomate saladet:60:g|Cebolla:20:g|Chile serrano:5:g|Tortilla de maíz:2:pza|Aceite:10:ml", 18.53]]],
    ["Pasta", [
      ["Pasta carbonara mexicana", "Cocer pasta. Dorar tocino picado con cebolla, agregar crema, leche y consomé; mezclar con la pasta.", "Fusilli (pasta seca):100:g|Tocino:20:g|Crema:40:g|Cebolla:20:g|Leche deslactosada:30:ml|Knor (consomé):2:g", 11.12],
      ["Pasta poblana con elote", "Asar y licuar poblano con crema, leche y consomé. Sofreír cebolla y elote, agregar salsa y pasta cocida.", "Fusilli (pasta seca):100:g|Chile poblano:50:g|Crema:40:g|Leche deslactosada:50:ml|Granos de elote:40:g|Cebolla:15:g|Knor (consomé):2:g", 13.44],
      ["Pasta con verduras al ajo y panela", "Saltear verduras en cubos con ajo y aceite, mezclar con pasta cocida y panela en cubos.", "Fusilli (pasta seca):100:g|Calabaza:60:g|Zanahoria:40:g|Cebolla:15:g|Ajo:3:g|Queso panela:30:g|Aceite:15:ml", 12.01],
      ["Pasta chipotle cremosa", "Licuar chipotle, crema y puré; sofreír con cebolla, agregar pasta cocida y panela rallada.", "Fusilli (pasta seca):100:g|Chipotle (lata):10:g|Crema:40:g|Puré de tomate:40:g|Cebolla:15:g|Queso panela:20:g", 12.71]]],
    ["Cerdo en bistec", [
      ["Bistec de cerdo encebollado con frijol", "Bistec a la plancha con cebolla en rodajas. Frijoles y tortillas.", "Cerdo en bistec:100:g|Cebolla:40:g|Frijol refrito:40:g|Tortilla de maíz:2:pza|Aceite:10:ml", 15.43],
      ["Bistec de cerdo en salsa verde con arroz", "Bistec en tiras dorado, cocer 10 min en la salsa verde de DÍA. Arroz.", "Cerdo en bistec:100:g|Arroz:50:g|Salsa verde:150:ml", 15.84],
      ["Bistec a la mexicana con papa", "Bistec en cubos con papa precocida, jitomate, cebolla y chile. Tortillas.", "Cerdo en bistec:100:g|Papa blanca:100:g|Jitomate saladet:60:g|Cebolla:20:g|Chile serrano:5:g|Tortilla de maíz:2:pza", 18.03],
      ["Tacos de bistec con verduras", "Bistec picado salteado con verdura y cebolla. 4 tacos con salsa.", "Cerdo en bistec:90:g|Mezcla veggie:0.4:porción|Cebolla:20:g|Tortilla de maíz:3:pza|Salsa tatemada:30:g", 16.14]]],
    ["Alambre Z (setas, pimiento y cebolla)", [
      ["Tacos de alambre de setas con queso", "Calentar el alambre en plancha, gratinar con queso. 4 tacos con salsa.", "Alambre Z:0.5:porción|Tortilla de maíz:3:pza|Queso manchego / gouda:20:g|Salsa tatemada:30:g", 15.97],
      ["Alambre de setas con arroz y frijol", "Alambre salteado en plancha. Arroz, frijoles y tortillas.", "Alambre Z:0.5:porción|Arroz:60:g|Frijol refrito:40:g|Tortilla de maíz:2:pza", 13.49],
      ["Quesadillas de alambre de setas", "1 quesadilla grande con alambre y queso, dorar en plancha. (1 tortilla burrera)", "Alambre Z:0.5:porción|Tortilla burrera:1:pza|Queso manchego / gouda:25:g|Salsa tatemada:30:g", 19.37],
      ["Pasta cremosa con alambre de setas", "Saltear el alambre con ajo, agregar crema y la pasta cocida.", "Fusilli (pasta seca):90:g|Alambre Z:0.5:porción|Crema:30:g|Ajo:3:g", 15.65]]],
    ["Masa y frijol (antojito)", [
      ["Sopes de frijol con chorizo", "3 sopes por persona. Frijol refrito con chorizo dorado, lechuga, crema, panela y salsa.", "Masa de maíz:120:g|Frijol refrito:50:g|Chorizo (porción):0.15:porción|Mezcla de lechugas:20:g|Crema:15:g|Queso panela:15:g|Salsa tatemada:30:g", 11.51],
      ["Tacos dorados de papa", "4 tacos. Rellenar tortilla con puré de papa sazonado, enrollar y freír. Lechuga, crema, panela y salsa.", "Tortilla de maíz:3:pza|Papa blanca:150:g|Mezcla de lechugas:30:g|Crema:20:g|Queso panela:15:g|Salsa tatemada:40:g|Aceite:25:ml", 14.7],
      ["Enfrijoladas con panela", "Licuar frijol con su caldo, calentar. Pasar tortillas por la salsa, doblar, rellenar con panela; crema y cebolla.", "Tortilla de maíz:3:pza|Frijol refrito:60:g|Queso panela:30:g|Crema:20:g|Cebolla:15:g|Aceite:10:ml", 10.12],
      ["Quesadillas de masa con rajas", "3 quesadillas. Rajas de poblano asado con cebolla; rellenar con rajas y queso. Frijoles aparte.", "Masa de maíz:150:g|Chile poblano:50:g|Cebolla:20:g|Queso manchego / gouda:30:g|Salsa tatemada:30:g|Frijol refrito:40:g", 11.81]]],
    ["Pescado (tilapia)", [
      ["Pescado empapelado con verduras y arroz", "Filete sobre papel aluminio con verduras en tiras, ajo, sal y aceite; cerrar y hornear 15 min a 200 °C. Arroz blanco.", "Tilapia (filete):110:g|Calabaza:50:g|Zanahoria:30:g|Cebolla:15:g|Ajo:2:g|Aceite:5:ml|Arroz:50:g", 16.93],
      ["Tacos de pescado empanizado", "Tiras de pescado pasadas por huevo y harina, freír. 4 tacos con lechuga, mayonesa y salsa.", "Tilapia (filete):100:g|Harina de trigo:15:g|Huevo:0.25:pza|Tortilla de maíz:3:pza|Mezcla de lechugas:30:g|Mayonesa:15:g|Salsa tatemada:20:g|Aceite:20:ml", 19.68],
      ["Pescado a la veracruzana con arroz", "Salsa de jitomate, cebolla y ajo sofritos; cocer el filete en la salsa 8 min. Arroz blanco.", "Tilapia (filete):110:g|Jitomate saladet:80:g|Cebolla:20:g|Ajo:2:g|Chile serrano:3:g|Aceite:10:ml|Arroz:50:g", 19.04],
      ["Pescado al ajillo con papas", "Dorar ajo en rebanadas en aceite, cocer el filete en ese aceite. Papas cocidas y doradas; lechuga.", "Tilapia (filete):110:g|Ajo:8:g|Aceite:15:ml|Papa blanca:120:g|Mezcla de lechugas:20:g", 19.87]]],
    ["Papa", [
      ["Tortitas de papa con queso en caldillo", "Puré de papa con queso, formar tortitas, capear con huevo y freír; caldillo de jitomate. Arroz.", "Papa blanca:180:g|Huevo:0.65:pza|Queso panela:30:g|Jitomate saladet:80:g|Cebolla:10:g|Aceite:20:ml|Arroz:40:g", 15.06],
      ["Papas con chorizo y frijol", "Dorar chorizo, agregar papa en cubo precocida y cebolla. Frijoles y tortillas.", "Papa blanca:180:g|Chorizo (porción):0.2:porción|Cebolla:20:g|Frijol refrito:40:g|Tortilla de maíz:2:pza", 9.56],
      ["Papas a la mexicana con huevo", "Papa en cubo dorada con jitomate, cebolla y chile; agregar huevo revuelto.", "Papa blanca:150:g|Huevo:1:pza|Jitomate saladet:50:g|Cebolla:15:g|Chile serrano:5:g|Tortilla de maíz:2:pza", 9.94],
      ["Crema de papa con tostadas de frijol", "Cocer papa con cebolla, licuar con leche y consomé. Tostadas con frijol y crema.", "Papa blanca:150:g|Leche deslactosada:150:ml|Cebolla:15:g|Knor (consomé):3:g|Tostada:2:pza|Frijol refrito:40:g|Crema:15:g", 12.16]]],
    ["Arrachera", [
      ["Tacos de arrachera con frijol", "Arrachera a la plancha picada con cebolla. 4 tacos con salsa; frijoles.", "Arrachera (porción):0.5:porción|Cebolla:30:g|Tortilla de maíz:3:pza|Frijol refrito:40:g|Salsa tatemada:30:g", 15.64],
      ["Arrachera encebollada con arroz", "Arrachera en tiras con cebolla a la plancha. Arroz y tortillas.", "Arrachera (porción):0.5:porción|Cebolla:40:g|Arroz:60:g|Tortilla de maíz:2:pza|Salsa tatemada:20:g", 15.39],
      ["Alambre de arrachera", "Arrachera picada con cebolla y poblano en tiras, gratinar con queso. Tortillas.", "Arrachera (porción):0.45:porción|Cebolla:30:g|Chile poblano:30:g|Queso manchego / gouda:20:g|Tortilla de maíz:3:pza", 15.81],
      ["Arrachera a la mexicana con papa", "Arrachera en cubos con papa precocida, jitomate, cebolla y chile. Tortillas.", "Arrachera (porción):0.45:porción|Papa blanca:100:g|Jitomate saladet:60:g|Cebolla:20:g|Chile serrano:5:g|Tortilla de maíz:2:pza", 15.68]]],
    ["Mezcla veggie", [
      ["Arroz con verduras y huevo estrellado", "Sofreír arroz con cebolla, cocer con la mezcla veggie. Huevo estrellado encima.", "Mezcla veggie:0.65:porción|Arroz:70:g|Huevo:1:pza|Cebolla:15:g|Aceite:10:ml", 7.91],
      ["Tortitas de verdura en salsa roja", "Verdura picada con huevo y harina, formar tortitas y freír; bañar en salsa roja. Frijoles.", "Mezcla veggie:0.8:porción|Huevo:0.65:pza|Harina de trigo:20:g|Jitomate saladet:60:g|Cebolla:10:g|Aceite:20:ml|Frijol refrito:40:g", 9.63],
      ["Quesadillas de verduras", "Saltear la mezcla con sal; 1 quesadilla grande con queso, dorar. (1 tortilla burrera)", "Mezcla veggie:0.65:porción|Tortilla burrera:1:pza|Queso manchego / gouda:25:g|Salsa tatemada:30:g", 12.69],
      ["Sopa de verduras con pasta", "Caldillo de jitomate con consomé; cocer verdura y pasta 10 min. Tortillas.", "Mezcla veggie:0.8:porción|Fusilli (pasta seca):40:g|Jitomate saladet:60:g|Cebolla:15:g|Knor (consomé):3:g|Tortilla de maíz:2:pza", 10.08]]],
    ["Jamón", [
      ["Sincronizadas de jamón y queso", "Tortilla, jamón y queso, tapar con otra tortilla y dorar. Frijoles y salsa. (1 tortilla burrera)", "Tortilla burrera:1:pza|Jamón:50:g|Queso manchego / gouda:25:g|Salsa tatemada:30:g|Frijol refrito:40:g", 16.85],
      ["Ensalada fría de coditos con jamón", "Pasta cocida y fría con jamón en cubos, elote, mayonesa y crema. Sobre lechuga.", "Fusilli (pasta seca):80:g|Jamón:50:g|Mayonesa:20:g|Crema:15:g|Granos de elote:30:g|Mezcla de lechugas:20:g", 14.63],
      ["Tortas de jamón", "Bolillo con frijol, jamón, queso, jitomate y aguacate; calentar en plancha.", "Pan bolillo:1:pza|Jamón:60:g|Frijol refrito:30:g|Jitomate saladet:30:g|Aguacate:20:g|Queso manchego / gouda:15:g", 16.82],
      ["Arroz frito con jamón y verduras", "Arroz cocido del día anterior salteado con jamón, verdura y huevo revuelto.", "Arroz:70:g|Jamón:50:g|Mezcla veggie:0.4:porción|Huevo:0.5:pza|Aceite:10:ml", 10.91]]],
    ["Carne molida", [
      ["Picadillo con papa y zanahoria", "Dorar carne con cebolla, agregar jitomate licuado, papa y zanahoria en cubo chico; cocer 15 min. Arroz y tortillas.", "Carne molida:90:g|Papa blanca:60:g|Zanahoria:40:g|Jitomate saladet:50:g|Cebolla:15:g|Arroz:50:g|Tortilla de maíz:2:pza", 18.01],
      ["Albóndigas en chipotle con arroz", "Mezclar carne con huevo y 10 g de arroz crudo, formar 4 albóndigas, cocer en caldillo de jitomate con chipotle. Arroz aparte.", "Carne molida:100:g|Arroz:60:g|Huevo:0.15:pza|Jitomate saladet:80:g|Chipotle (lata):8:g|Cebolla:15:g|Tortilla de maíz:2:pza", 19.82],
      ["Calabacitas con carne molida", "Dorar carne, agregar calabaza en cubo, elote y jitomate. Frijoles y tortillas.", "Carne molida:80:g|Calabaza:120:g|Granos de elote:30:g|Jitomate saladet:50:g|Cebolla:15:g|Frijol refrito:40:g|Tortilla de maíz:2:pza", 18.77],
      ["Tacos de carne molida con papa", "Guisar carne con papa en cubo chico y cebolla. 4 tacos con lechuga y salsa.", "Carne molida:80:g|Papa blanca:80:g|Tortilla de maíz:3:pza|Cebolla:20:g|Salsa tatemada:40:g|Mezcla de lechugas:20:g", 17.9]]],
    ["Queso", [
      ["Queso panela asado en salsa verde", "Dorar rebanadas de panela en plancha, bañar con la salsa verde de DÍA caliente. Frijoles y tortillas.", "Queso panela:80:g|Frijol refrito:40:g|Tortilla de maíz:2:pza|Salsa verde:150:ml", 16.79],
      ["Chiles rellenos de queso en caldillo", "Asar y pelar chiles, rellenar con panela, capear con huevo batido y harina, freír; servir en caldillo de jitomate. Arroz.", "Chile poblano:120:g|Queso panela:60:g|Huevo:0.65:pza|Harina de trigo:10:g|Jitomate saladet:80:g|Cebolla:10:g|Aceite:25:ml|Arroz:50:g", 19.53],
      ["Enchiladas suizas de queso", "Licuar la salsa verde de DÍA con la crema. Tortillas rellenas de queso, bañar con la salsa y gratinar.", "Tortilla de maíz:3:pza|Queso manchego / gouda:40:g|Crema:30:g|Salsa verde:150:ml", 13.3],
      ["Molletes de queso con pico de gallo", "Bolillo con frijol y queso, gratinar. Pico de gallo de DÍA encima.", "Pan bolillo:2:pza|Frijol refrito:40:g|Queso manchego / gouda:40:g|Pico de gallo:50:g", 18.33]]],
    ["Atún", [
      ["Tostadas de atún a la mexicana", "Mezclar atún escurrido con jitomate, cebolla y chile picados y un poco de mayonesa. Servir en tostadas con aguacate.", "Atún en lata 140 g:0.5:pza|Jitomate saladet:50:g|Cebolla:20:g|Chile serrano:5:g|Tostada:3:pza|Aguacate:25:g|Mayonesa:10:g", 19.74],
      ["Tortitas de papa con atún", "Puré de papa con atún y huevo, formar tortitas, freír. Salsa verde de DÍA y arroz.", "Atún en lata 140 g:0.5:pza|Papa blanca:150:g|Huevo:0.5:pza|Arroz:50:g|Aceite:20:ml|Salsa verde:100:ml", 21.0],
      ["Ensalada fría de pasta con atún", "Pasta cocida y fría con atún, mayonesa, elote y zanahoria rallada. Servir sobre lechuga.", "Atún en lata 140 g:0.5:pza|Fusilli (pasta seca):70:g|Mayonesa:25:g|Granos de elote:30:g|Zanahoria:30:g|Mezcla de lechugas:20:g", 20.31],
      ["Atún a la mexicana con arroz", "Sofreír jitomate, cebolla y chile; agregar atún. Arroz y tortillas.", "Atún en lata 140 g:0.5:pza|Jitomate saladet:60:g|Cebolla:20:g|Chile serrano:5:g|Arroz:60:g|Tortilla de maíz:2:pza|Aceite:10:ml", 18.91]]],
    ["Chicharrón", [
      ["Chicharrón en salsa verde con frijol", "Hervir el chicharrón en la salsa verde de DÍA 10 min hasta que se suavice. Frijoles y tortillas.", "Chicharrón:60:g|Frijol refrito:40:g|Tortilla de maíz:2:pza|Salsa verde:180:ml", 16.27],
      ["Chicharrón en salsa roja con arroz", "Igual que el verde pero en salsa de jitomate. Arroz.", "Chicharrón:60:g|Jitomate saladet:100:g|Chile serrano:5:g|Cebolla:15:g|Arroz:50:g|Tortilla de maíz:2:pza", 17.24],
      ["Gorditas de chicharrón", "Chicharrón en salsa verde de DÍA, espeso; 3 gorditas rellenas con lechuga y panela.", "Masa de maíz:120:g|Chicharrón:50:g|Mezcla de lechugas:20:g|Queso panela:15:g|Salsa verde:80:ml", 15.78],
      ["Tacos de chicharrón con papa", "Chicharrón guisado en salsa verde de DÍA con papa en cubo. 4 tacos.", "Chicharrón:50:g|Papa blanca:100:g|Tortilla de maíz:3:pza|Salsa verde:100:ml", 14.8]]],
    ["Salchicha", [
      ["Salchichas a la mexicana con arroz y frijol", "Salchicha en rodajas dorada con jitomate, cebolla y chile. Arroz, frijoles y tortillas.", "Salchicha:100:g|Jitomate saladet:50:g|Cebolla:20:g|Chile serrano:5:g|Arroz:50:g|Frijol refrito:40:g|Tortilla de maíz:2:pza", 14.33],
      ["Salchichas en chipotle con papa", "Salsa de jitomate, chipotle y crema; agregar salchicha y papa en cubos precocida.", "Salchicha:100:g|Papa blanca:120:g|Jitomate saladet:60:g|Chipotle (lata):8:g|Crema:20:g|Tortilla de maíz:2:pza", 16.36],
      ["Burritos de salchicha con frijol y queso", "Salchicha picada con cebolla; 1 burrito grande con frijol refrito y queso, dorar en plancha. (1 tortilla burrera)", "Salchicha:80:g|Tortilla burrera:1:pza|Frijol refrito:50:g|Queso manchego / gouda:20:g|Cebolla:15:g|Salsa tatemada:30:g", 17.21],
      ["Salchichas con verduras salteadas y arroz", "Saltear salchicha con verduras en tiras y ajo. Arroz blanco.", "Salchicha:90:g|Calabaza:60:g|Zanahoria:40:g|Cebolla:20:g|Ajo:2:g|Arroz:60:g|Aceite:10:ml", 12.1]]]
  ],
  desayuno: [
    ["Avena", [
      ["Avena con plátano y canela", "Cocer avena en leche con canela 5 min; plátano en rodajas encima.", "Avena:50:g|Leche deslactosada:200:ml|Plátano:60:g|Canela:1:g|Azúcar:10:g", 8.44],
      ["Avena horneada con manzana", "Mezclar todo, hornear en charola 25 min a 180 °C y cortar en cuadros.", "Avena:50:g|Leche deslactosada:120:ml|Huevo:0.35:pza|Manzana:60:g|Azúcar:10:g|Canela:1:g", 9.25],
      ["Avena fría con yogurt y fruta", "Dejar avena remojando en yogurt y leche desde la noche anterior; fruta y miel al servir.", "Avena:40:g|Yogurt natural:100:g|Leche deslactosada:60:ml|Papaya:60:g|Miel de abeja:8:g", 10.35],
      ["Atole de avena con pan tostado", "Licuar avena cocida con leche, hervir con canela y azúcar. Bolillo tostado.", "Avena:35:g|Leche deslactosada:200:ml|Azúcar:12:g|Canela:1:g|Pan bolillo:1:pza", 11.18]]],
    ["Hot cakes / crepas", [
      ["Hot cakes con maple", "2 hot cakes por persona (75 g de masa cada uno) con la masa de wafles de DÍA.", "Masa wafles:150:g|Mantequilla:5:g|Miel de maple:20:g", 6.77],
      ["Wafles con plátano", "1 wafle en la wafleta con 125 g de la masa de wafles de DÍA; plátano y maple.", "Masa wafles:125:g|Plátano:60:g|Miel de maple:15:g", 5.9],
      ["Crepas de caramelo y plátano", "2 crepas. Sirve para practicar la masa de las crepas del menú nuevo.", "Harina de trigo:35:g|Leche deslactosada:80:ml|Huevo:0.4:pza|Mantequilla:5:g|Caramelo (bote):20:g|Plátano:50:g", 6.65],
      ["Hot cakes de avena y plátano", "Licuar todo y cocer como hot cake en plancha.", "Avena:40:g|Plátano:80:g|Huevo:0.65:pza|Leche deslactosada:40:ml|Miel de abeja:10:g", 6.74]]],
    ["Fruta y licuado", [
      ["Licuado de plátano con avena", "Licuar todo.", "Leche deslactosada:250:ml|Plátano:100:g|Avena:20:g|Azúcar:8:g", 9.2],
      ["Fruta con yogurt y granola", "Usar la fruta más madura del día.", "Papaya:100:g|Plátano:50:g|Yogurt natural:100:g|Granola:25:g|Miel de abeja:8:g", 11.76],
      ["Licuado de fresa", "Licuar todo.", "Leche deslactosada:200:ml|Fresa:60:g|Azúcar:12:g", 10.93],
      ["Coctel de fruta con granola y miel", "Fruta en cubos con granola y miel.", "Papaya:100:g|Manzana:60:g|Plátano:50:g|Granola:25:g|Miel de abeja:10:g", 10.56]]],
    ["Pan", [
      ["Molletes sencillos", "Bolillo abierto con frijol refrito y queso, gratinar. Salsa.", "Pan bolillo:1:pza|Frijol refrito:30:g|Queso manchego / gouda:15:g|Salsa tatemada:20:g", 8.36],
      ["Pan francés", "Remojar pan en huevo, leche y canela; dorar en plancha con mantequilla.", "Pan de caja:2:pza|Huevo:0.5:pza|Leche deslactosada:40:ml|Canela:1:g|Mantequilla:5:g|Miel de maple:15:g", 13.26],
      ["Sándwich de jamón y queso a la plancha", "Armar y dorar en plancha.", "Pan de caja:2:pza|Jamón:25:g|Queso manchego / gouda:15:g|Mantequilla:5:g", 14.85],
      ["Torta de huevo con frijol", "Huevo revuelto en bolillo con frijol y salsa.", "Pan bolillo:1:pza|Huevo:1:pza|Frijol refrito:30:g|Salsa tatemada:20:g", 8.66]]],
    ["Huevo", [
      ["Tacos de huevo con frijol", "2 tacos de huevo revuelto con frijol.", "Huevo:1:pza|Tortilla de maíz:2:pza|Frijol refrito:30:g|Salsa tatemada:20:g", 5.76],
      ["Burrito de huevo con papa", "Huevo revuelto con papa en cubo dorada, en tortilla de harina.", "Huevo:1:pza|Papa blanca:60:g|Tortilla burrera:1:pza|Salsa tatemada:20:g", 9.79],
      ["Huevo en salsa roja con tortillas", "Huevo estrellado o revuelto cocido en salsa roja.", "Huevo:1:pza|Jitomate saladet:60:g|Cebolla:10:g|Chile serrano:3:g|Tortilla de maíz:2:pza", 6.8],
      ["Quesadilla de huevo y queso", "Huevo revuelto y queso dentro de la tortilla, dorar.", "Huevo:1:pza|Tortilla burrera:1:pza|Queso manchego / gouda:15:g|Salsa tatemada:20:g", 10.57]]],
    ["Tortilla y frijol", [
      ["Enfrijoladas sencillas", "2 enfrijoladas con panela y crema.", "Tortilla de maíz:2:pza|Frijol refrito:40:g|Queso panela:15:g|Crema:10:g", 5.22],
      ["Chilaquiles rojos sencillos", "Con la tortilla que sobró del día anterior.", "Tortilla de maíz:2:pza|Jitomate saladet:70:g|Chile serrano:3:g|Cebolla:10:g|Crema:10:g|Queso panela:10:g|Aceite:15:ml", 7.4],
      ["Tostadas de frijol con queso", "Frijol refrito, panela, lechuga y salsa.", "Tostada:2:pza|Frijol refrito:40:g|Queso panela:15:g|Mezcla de lechugas:15:g|Salsa tatemada:20:g", 7.22],
      ["Tacos de papa con frijol", "2 tacos de papa guisada con frijol.", "Tortilla de maíz:2:pza|Papa blanca:80:g|Frijol refrito:30:g|Salsa tatemada:20:g", 5.12]]],
    ["Cereal y atole", [
      ["Cereal con leche y plátano", "Servir al momento.", "Cereal:30:g|Leche deslactosada:200:ml|Plátano:60:g", 8.94],
      ["Arroz con leche", "Se puede preparar el sábado en la tarde.", "Arroz:30:g|Leche deslactosada:200:ml|Azúcar:15:g|Canela:1:g|Vainilla:2:ml", 6.63],
      ["Champurrado con galletas", "Disolver masa en agua, hervir con leche, chocolate y piloncillo.", "Masa de maíz:30:g|Leche deslactosada:200:ml|Chocolate de mesa:15:g|Piloncillo:10:g|Galletas María:20:g", 8.96],
      ["Pan dulce con atole de vainilla", "Atole de fécula con vainilla. Va una vez por ciclo.", "Pan dulce:1:pza|Leche deslactosada:200:ml|Fécula de maíz:15:g|Azúcar:15:g|Vainilla:2:ml", 16.01]]]
  ],
  /* Insumos con precio estimado (no están en el Recetario): darlos de alta */
  estimados: ["Arroz","Masa de maíz","Atún en lata 140 g","Tostada","Salchicha","Cereal","Pan dulce","Galletas María","Chocolate de mesa","Piloncillo","Tilapia (filete)","Cerdo en bistec","Chicharrón","Chipotle (lata)"],
  /* Subrecetas que se piden como producción de DÍA, no como compra en PAR */
  produccion: ["Alambre Z","Mezcla veggie","Salsa tatemada","Salsa verde","Totopos","Pico de gallo","Masa wafles","Arrachera (porción)","Chorizo (porción)","Granola"],
  /* Avisos para la lista de mañana */
  avisos: { "Tilapia (filete)": "Descongelar un día antes", "Arrachera (porción)": "Registrar la salida como 'personal'", "Alambre Z": "Pedir a DÍA (media porción por persona)", "Chipotle (lata)": "Se calcula con lata de 220 g (confirmar)" },
  /* Liga de cada insumo con el Recetario costeado (i: insumo, r: subreceta) */
  recetario: {"Huevo": "i:huevo", "Tortilla de maíz": "i:tortilla_maiz", "Jitomate saladet": "i:jitomate", "Cebolla": "i:cebolla", "Chile serrano": "i:chile", "Frijol refrito": "i:frijol", "Aceite": "i:aceite", "Arroz": "estimado", "Papa blanca": "i:papa_blanca", "Salsa verde": "r:sr_salsa_verde", "Totopos": "r:sr_totopos", "Crema": "i:crema", "Queso panela": "i:queso_panela", "Pollo limpio": "i:pollo", "Chipotle (lata)": "chipotle", "Tostada": "estimado", "Mezcla de lechugas": "i:lechugas", "Fusilli (pasta seca)": "i:fusilli", "Tocino": "i:tocino", "Leche deslactosada": "i:leche", "Knor (consomé)": "i:par_knor_de_res", "Chile poblano": "i:chile_poblano", "Granos de elote": "i:elote", "Calabaza": "i:calabaza", "Zanahoria": "i:zanahoria", "Ajo": "i:ajo", "Puré de tomate": "i:par_pure_de_tomate", "Cerdo en bistec": "estimado", "Mezcla veggie": "r:sr_mezcla_veggie", "Salsa tatemada": "r:sr_salsa_tatemada", "Alambre Z": "r:sr_alambre_z", "Queso manchego / gouda": "i:queso_manchego", "Tortilla burrera": "i:tortilla_burrera", "Masa de maíz": "estimado", "Chorizo (porción)": "r:sr_chorizo", "Tilapia (filete)": "estimado", "Harina de trigo": "i:par_harina_de_trigo", "Mayonesa": "i:par_mayonesa_bote", "Arrachera (porción)": "r:sr_arrachera_porcion", "Jamón": "i:jamon", "Pan bolillo": "i:pan_bolillo", "Aguacate": "i:aguacate", "Carne molida": "i:insumo_tgqc", "Pico de gallo": "r:b_pico", "Atún en lata 140 g": "estimado", "Chicharrón": "estimado", "Salchicha": "estimado", "Avena": "i:par_avena", "Plátano": "i:platano", "Canela": "i:par_canela_bote", "Azúcar": "i:insumo_8wr5", "Manzana": "i:manzana", "Yogurt natural": "i:yogurt", "Papaya": "i:insumo_z6j2", "Miel de abeja": "i:par_miel_de_abeja", "Masa wafles": "r:sr_masa_wafles", "Mantequilla": "i:mantequilla", "Miel de maple": "i:maple", "Caramelo (bote)": "i:par_caramelo_bote", "Granola": "r:sr_granola", "Fresa": "i:fresa", "Pan de caja": "i:pan_caja", "Cereal": "estimado", "Vainilla": "i:par_vainilla", "Chocolate de mesa": "estimado", "Piloncillo": "estimado", "Galletas María": "estimado", "Pan dulce": "estimado", "Fécula de maíz": "i:par_fecula_de_maiz", "Café americano (grano)": "i:par_cafe_americano"}
};
export default CICLO;
