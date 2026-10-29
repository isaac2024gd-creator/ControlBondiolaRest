/* Menú de personal Bondiola – ciclo por ingrediente. Versión 2026-10-28t.
   Ingredientes con los nombres, subrecetas y precios del Recetario costeado (28 oct 2026, con rendimiento).
   Formato de cada preparación: [nombre, preparación, "Insumo:cantidad:unidad|...", costo por persona (con libres), libres, porción de proteína]
   Regla de porciones (28 oct 2026): proteína como ingrediente principal = 1 porción por persona;
   en guisado o como complemento = media porción. Si la porción es media o la receta es sencilla, lleva 1 guarnición (arroz, frijol o papa).
   Libres: "tortilla" = 3 tortillas + salsa por persona; "salsa" = solo salsa; "" = sin libres. */
const CICLO = {
  version: "2026-10-28t",
  inicio: "2026-11-02",
  cafe: { insumo: "Café americano (grano)", cantidad: 12, unidad: "g", costo: 4.8 },
  topes: { desayuno: 10, comida: 28, dia: 35 },
  libres: {
    tortilla: "Tortilla de maíz:3:pza|Salsa tatemada:40:g",
    salsa: "Salsa tatemada:40:g",
  },
  porciones: {
    completa: "Porción completa de proteína (ingrediente principal)",
    media: "Media porción de proteína (guisado o complemento)",
  },
  presupuesto: { min: 30, max: 35 },
  comida: [
    ["Huevo", [
      ["Huevos rancheros con frijol", "Freír tortilla ligeramente, 2 huevos estrellados encima, bañar con salsa roja (jitomate, cebolla y serrano licuados y fritos). Frijoles aparte.", "Huevo:2:pza|Tortilla de maíz:2:pza|Jitomate saladet:80:g|Cebolla:15:g|Chile serrano:5:g|Frijol refrito:50:g|Aceite:10:ml", 16.33, "tortilla", "completa"],
      ["Huevo a la mexicana con arroz", "Sofreír jitomate, cebolla y chile picados; agregar 2 huevos y revolver. Arroz aparte.", "Huevo:2:pza|Jitomate saladet:50:g|Cebolla:20:g|Chile serrano:5:g|Arroz:60:g|Aceite:10:ml", 14.21, "tortilla", "completa"],
      ["Tortitas de papa con huevo en salsa verde con frijol", "Cocer y machacar la papa, mezclar con huevo y cebolla, formar tortitas y freír. Bañar con salsa verde. Frijoles aparte.", "Huevo:1:pza|Papa blanca:150:g|Cebolla:15:g|Frijol refrito:50:g|Aceite:20:ml|Salsa verde:120:ml", 15.51, "tortilla", "media"],
      ["Chilaquiles verdes con huevo", "Calentar la salsa verde de DÍA, agregar los totopos y dar un hervor de 1–2 min; huevo estrellado o revuelto encima, crema y panela.", "Totopos:0.75:porción|Salsa verde:200:ml|Huevo:1:pza|Crema:20:g|Queso panela:20:g", 14.53, "", "media"]]],
    ["Pollo", [
      ["Fajitas de pollo con frijol", "Pollo marinado en tiras a la plancha con pimiento y cebolla en tiras. Frijoles aparte.", "Pollo marinado (porción):1:porción|Pimiento morrón:40:g|Cebolla:40:g|Aceite:10:ml|Frijol refrito:50:g", 28.17, "tortilla", "completa"],
      ["Pollo en salsa verde con arroz", "Pollo marinado en trozos, dorar y cocer 10 min en la salsa verde de DÍA con papa en cubo precocida. Arroz aparte.", "Pollo marinado (porción):0.5:porción|Salsa verde:150:ml|Papa blanca:60:g|Arroz:60:g", 20.19, "tortilla", "media"],
      ["Burrito de pollo con frijol y queso", "Pollo marinado picado a la plancha; 1 burrito grande con frijol, queso y pico de gallo, dorar en plancha.", "Pollo marinado (porción):0.5:porción|Tortilla burrera:1:pza|Frijol refrito:60:g|Queso manchego / gouda:15:g|Pico de gallo:30:g", 21.76, "salsa", "media"],
      ["Pasta cremosa con pollo, poblano y elote", "Cocer la pasta. Dorar el pollo marinado en cubos, agregar poblano en rajas, elote y crema; mezclar con la pasta.", "Pollo marinado (porción):0.5:porción|Fusilli (pasta seca):80:g|Crema:50:g|Chile poblano:30:g|Granos de elote:25:g", 18.55, "", "media"]]],
    ["Pasta", [
      ["Pasta carbonara mexicana", "Cocer pasta. Dorar tocino picado con cebolla, agregar crema, leche y consomé; mezclar con la pasta.", "Fusilli (pasta seca):100:g|Tocino:20:g|Crema:40:g|Cebolla:20:g|Leche deslactosada:30:ml|Knor (consomé):2:g", 11.12, "", "media"],
      ["Pasta poblana con elote", "Asar y licuar poblano con crema, leche y consomé. Sofreír cebolla y elote, agregar salsa y pasta cocida.", "Fusilli (pasta seca):100:g|Chile poblano:50:g|Crema:40:g|Leche deslactosada:50:ml|Granos de elote:40:g|Cebolla:15:g|Knor (consomé):2:g", 13.44, "", "media"],
      ["Pasta con verduras al ajo y panela", "Saltear verduras en cubos con ajo y aceite, mezclar con pasta cocida y panela en cubos.", "Fusilli (pasta seca):100:g|Calabaza:60:g|Zanahoria:40:g|Cebolla:15:g|Ajo:3:g|Queso panela:30:g|Aceite:15:ml", 12.01, "", "media"],
      ["Pasta chipotle cremosa", "Licuar chipotle, crema y puré; sofreír con cebolla, agregar pasta cocida y panela rallada.", "Fusilli (pasta seca):100:g|Chipotle (lata):10:g|Crema:40:g|Puré de tomate:40:g|Cebolla:15:g|Queso panela:20:g", 12.71, "", "media"]]],
    ["Cerdo en bistec", [
      ["Bistec de cerdo encebollado con frijol", "Bistec entero a la plancha con cebolla en rodajas. Frijoles aparte.", "Cerdo en bistec:150:g|Cebolla:40:g|Frijol refrito:50:g|Aceite:10:ml", 24.08, "tortilla", "completa"],
      ["Bistec de cerdo en salsa verde con arroz", "Bistec en tiras dorado, cocer 10 min en la salsa verde de DÍA. Arroz aparte.", "Cerdo en bistec:75:g|Arroz:60:g|Salsa verde:150:ml", 17.81, "tortilla", "media"],
      ["Bistec a la mexicana con papa y frijol", "Bistec en cubos con papa precocida, jitomate, cebolla y chile. Frijoles aparte.", "Cerdo en bistec:75:g|Papa blanca:100:g|Jitomate saladet:60:g|Cebolla:20:g|Chile serrano:5:g|Frijol refrito:50:g", 19.43, "tortilla", "media"],
      ["Tacos de bistec con verduras y frijol", "Bistec picado salteado con verdura y cebolla. 4 tacos con salsa; frijoles aparte.", "Cerdo en bistec:75:g|Mezcla veggie:0.4:porción|Cebolla:20:g|Tortilla de maíz:3:pza|Salsa tatemada:30:g|Frijol refrito:50:g", 15.75, "", "media"]]],
    ["Alambre Z (setas, pimiento y cebolla)", [
      ["Tacos de alambre de setas con queso", "Calentar el alambre en plancha, gratinar con queso. 4 tacos con salsa.", "Alambre Z:1:porción|Tortilla de maíz:3:pza|Queso manchego / gouda:20:g|Salsa tatemada:30:g", 25.24, "", "completa"],
      ["Alambre de setas con arroz", "Alambre salteado en plancha. Arroz aparte.", "Alambre Z:1:porción|Arroz:60:g", 24.65, "tortilla", "completa"],
      ["Quesadillas de alambre de setas con frijol", "1 quesadilla grande con alambre y queso, dorar en plancha. (1 tortilla burrera). Frijoles aparte.", "Alambre Z:0.5:porción|Tortilla burrera:1:pza|Queso manchego / gouda:25:g|Frijol refrito:50:g", 21.16, "salsa", "media"],
      ["Pasta cremosa con alambre de setas", "Saltear el alambre con ajo, agregar crema y la pasta cocida.", "Fusilli (pasta seca):90:g|Alambre Z:0.5:porción|Crema:30:g|Ajo:3:g", 15.65, "", "media"]]],
    ["Masa y frijol (antojito)", [
      ["Sopes de frijol con chorizo", "3 sopes por persona. Frijol refrito con chorizo dorado, lechuga, crema, panela y salsa.", "Masa de maíz:120:g|Frijol refrito:50:g|Chorizo (porción):0.5:porción|Mezcla de lechugas:20:g|Crema:15:g|Queso panela:15:g|Salsa tatemada:30:g", 15.57, "", "media"],
      ["Tacos dorados de papa", "4 tacos. Rellenar tortilla con puré de papa sazonado, enrollar y freír. Lechuga, crema, panela y salsa.", "Tortilla de maíz:3:pza|Papa blanca:150:g|Mezcla de lechugas:30:g|Crema:20:g|Queso panela:15:g|Salsa tatemada:40:g|Aceite:25:ml", 14.7, "", "media"],
      ["Enfrijoladas con panela", "Licuar frijol con su caldo, calentar. Pasar tortillas por la salsa, doblar, rellenar con panela; crema y cebolla.", "Tortilla de maíz:3:pza|Frijol refrito:60:g|Queso panela:30:g|Crema:20:g|Cebolla:15:g|Aceite:10:ml", 12.25, "salsa", "media"],
      ["Quesadillas de masa con rajas y frijol", "3 quesadillas. Rajas de poblano asado con cebolla; rellenar con rajas y queso. Frijoles aparte.", "Masa de maíz:150:g|Chile poblano:50:g|Cebolla:20:g|Queso manchego / gouda:30:g|Salsa tatemada:30:g|Frijol refrito:50:g", 12.06, "", "media"]]],
    ["Pescado (tilapia)", [
      ["Pescado empapelado con verduras y arroz", "Filete sobre papel aluminio con verduras en tiras, ajo, sal y aceite; cerrar y hornear 15 min a 200 °C. Arroz aparte.", "Tilapia (filete):150:g|Calabaza:50:g|Zanahoria:30:g|Cebolla:15:g|Ajo:2:g|Aceite:5:ml|Arroz:60:g", 26.25, "tortilla", "completa"],
      ["Tacos de pescado empanizado", "Tiras de pescado pasadas por huevo y harina, freír. 4 tacos con lechuga, mayonesa y salsa.", "Tilapia (filete):150:g|Harina de trigo:15:g|Huevo:0.25:pza|Tortilla de maíz:3:pza|Mezcla de lechugas:30:g|Mayonesa:15:g|Salsa tatemada:20:g|Aceite:20:ml", 25.43, "", "completa"],
      ["Pescado a la veracruzana con arroz", "Salsa de jitomate, cebolla y ajo sofritos; cocer el filete en la salsa 8 min. Arroz aparte.", "Tilapia (filete):150:g|Jitomate saladet:80:g|Cebolla:20:g|Ajo:2:g|Chile serrano:3:g|Aceite:10:ml|Arroz:60:g", 28.35, "tortilla", "completa"],
      ["Pescado al ajillo con papas", "Dorar ajo en rebanadas en aceite, cocer el filete en ese aceite. Papas cocidas y doradas.", "Tilapia (filete):150:g|Ajo:8:g|Aceite:15:ml|Papa blanca:120:g", 27.15, "tortilla", "completa"]]],
    ["Papa", [
      ["Tortitas de papa con queso en caldillo con arroz", "Puré de papa con queso, formar tortitas, capear con huevo y freír; caldillo de jitomate. Arroz aparte.", "Papa blanca:180:g|Huevo:0.65:pza|Queso panela:30:g|Jitomate saladet:80:g|Cebolla:10:g|Aceite:20:ml|Arroz:50:g", 19.78, "tortilla", "media"],
      ["Papas con chorizo y frijol", "Dorar chorizo, agregar papa en cubo precocida y cebolla. Frijoles aparte.", "Papa blanca:180:g|Chorizo (porción):0.5:porción|Cebolla:20:g|Frijol refrito:50:g", 16.19, "tortilla", "media"],
      ["Papas a la mexicana con huevo y frijol", "Papa en cubo dorada con jitomate, cebolla y chile; agregar huevo revuelto. Frijoles aparte.", "Papa blanca:150:g|Huevo:1:pza|Jitomate saladet:50:g|Cebolla:15:g|Chile serrano:5:g|Frijol refrito:50:g", 14.1, "tortilla", "media"],
      ["Crema de papa con tostadas de frijol", "Cocer papa con cebolla, licuar con leche y consomé. Tostadas con frijol y crema.", "Papa blanca:150:g|Leche deslactosada:150:ml|Cebolla:15:g|Knor (consomé):3:g|Tostada:2:pza|Frijol refrito:40:g|Crema:15:g", 14.29, "salsa", "media"]]],
    ["Arrachera", [
      ["Tacos de arrachera con frijol", "Arrachera a la plancha picada con cebolla. 4 tacos con salsa; frijoles aparte.", "Arrachera (porción):1:porción|Cebolla:30:g|Tortilla de maíz:3:pza|Frijol refrito:50:g|Salsa tatemada:30:g", 25.51, "", "completa"],
      ["Arrachera encebollada con arroz", "Arrachera entera a la plancha con cebolla. Arroz aparte.", "Arrachera (porción):1:porción|Cebolla:40:g|Arroz:60:g", 26.84, "tortilla", "completa"],
      ["Alambre de arrachera con frijol", "Arrachera picada con cebolla y poblano en tiras, gratinar con queso. Frijoles aparte.", "Arrachera (porción):0.5:porción|Cebolla:30:g|Chile poblano:30:g|Queso manchego / gouda:20:g|Frijol refrito:50:g", 20.16, "tortilla", "media"],
      ["Arrachera a la mexicana con papa y frijol", "Arrachera en cubos con papa precocida, jitomate, cebolla y chile. Frijoles aparte.", "Arrachera (porción):0.5:porción|Papa blanca:100:g|Jitomate saladet:60:g|Cebolla:20:g|Chile serrano:5:g|Frijol refrito:50:g", 20.8, "tortilla", "media"]]],
    ["Mezcla veggie", [
      ["Arroz con verduras y huevo estrellado", "Sofreír arroz con cebolla, cocer con la mezcla veggie. Huevo estrellado encima.", "Mezcla veggie:0.65:porción|Arroz:70:g|Huevo:1:pza|Cebolla:15:g|Aceite:10:ml", 12.35, "tortilla", "media"],
      ["Tortitas de verdura en salsa roja con frijol", "Verdura picada con huevo y harina, formar tortitas y freír; bañar en salsa roja. Frijoles aparte.", "Mezcla veggie:0.8:porción|Huevo:0.65:pza|Harina de trigo:20:g|Jitomate saladet:60:g|Cebolla:10:g|Aceite:20:ml|Frijol refrito:50:g", 14.32, "tortilla", "media"],
      ["Quesadillas de verduras", "Saltear la mezcla con sal; 1 quesadilla grande con queso, dorar. (1 tortilla burrera)", "Mezcla veggie:0.65:porción|Tortilla burrera:1:pza|Queso manchego / gouda:25:g|Salsa tatemada:30:g|Frijol refrito:50:g", 13.95, "", "media"],
      ["Sopa de verduras con pasta", "Caldillo de jitomate con consomé; cocer verdura y pasta 10 min.", "Mezcla veggie:0.8:porción|Fusilli (pasta seca):40:g|Jitomate saladet:60:g|Cebolla:15:g|Knor (consomé):3:g", 12.98, "tortilla", "media"]]],
    ["Jamón", [
      ["Sincronizadas de jamón y queso con frijol", "Tortilla, jamón y queso, tapar con otra tortilla y dorar. Frijoles y salsa. (1 tortilla burrera)", "Tortilla burrera:1:pza|Jamón:40:g|Queso manchego / gouda:25:g|Salsa tatemada:30:g|Frijol refrito:50:g", 15.96, "", "media"],
      ["Ensalada fría de coditos con jamón", "Pasta cocida y fría con jamón en cubos, elote, mayonesa y crema. Sobre lechuga.", "Fusilli (pasta seca):80:g|Jamón:40:g|Mayonesa:20:g|Crema:15:g|Granos de elote:30:g|Mezcla de lechugas:20:g", 13.48, "", "media"],
      ["Tortas de jamón", "Bolillo con frijol, jamón, queso, jitomate y aguacate; calentar en plancha.", "Pan bolillo:1:pza|Jamón:80:g|Frijol refrito:30:g|Jitomate saladet:30:g|Aguacate:20:g|Queso manchego / gouda:15:g", 21.25, "salsa", "completa"],
      ["Arroz frito con jamón y verduras", "Arroz cocido del día anterior salteado con jamón, verdura y huevo revuelto.", "Arroz:70:g|Jamón:40:g|Mezcla veggie:0.4:porción|Huevo:0.5:pza|Aceite:10:ml", 11.89, "salsa", "media"]]],
    ["Carne molida", [
      ["Picadillo con papa y zanahoria con arroz", "Dorar carne con cebolla, agregar jitomate licuado, papa y zanahoria en cubo chico; cocer 15 min. Arroz aparte.", "Carne molida:75:g|Papa blanca:60:g|Zanahoria:40:g|Jitomate saladet:50:g|Cebolla:15:g|Arroz:60:g", 19.46, "tortilla", "media"],
      ["Albóndigas en chipotle con arroz", "Mezclar carne con huevo y 10 g de arroz crudo, formar 5 albóndigas, cocer en caldillo de jitomate con chipotle. Arroz aparte.", "Carne molida:150:g|Arroz:60:g|Huevo:0.2:pza|Jitomate saladet:80:g|Chipotle (lata):8:g|Cebolla:15:g", 28.59, "tortilla", "completa"],
      ["Calabacitas con carne molida y frijol", "Dorar carne, agregar calabaza en cubo, elote y jitomate. Frijoles aparte.", "Carne molida:75:g|Calabaza:120:g|Granos de elote:30:g|Jitomate saladet:50:g|Cebolla:15:g|Frijol refrito:50:g", 21.34, "tortilla", "media"],
      ["Tacos de carne molida con papa y frijol", "Guisar carne con papa en cubo chico y cebolla. 4 tacos con lechuga y salsa; frijoles aparte.", "Carne molida:75:g|Papa blanca:80:g|Tortilla de maíz:3:pza|Cebolla:20:g|Salsa tatemada:40:g|Frijol refrito:50:g", 16.82, "", "media"]]],
    ["Queso", [
      ["Queso panela asado en salsa verde con frijol", "Dorar rebanadas de panela en plancha, bañar con la salsa verde de DÍA caliente. Frijoles aparte.", "Queso panela:80:g|Frijol refrito:50:g|Salsa verde:150:ml", 19.94, "tortilla", "completa"],
      ["Chiles rellenos de queso en caldillo con arroz", "Asar y pelar chiles, rellenar con panela, capear con huevo batido y harina, freír; servir en caldillo de jitomate. Arroz aparte.", "Chile poblano:120:g|Queso panela:40:g|Huevo:0.65:pza|Harina de trigo:10:g|Jitomate saladet:80:g|Cebolla:10:g|Aceite:25:ml|Arroz:60:g", 21.55, "tortilla", "media"],
      ["Enchiladas suizas de queso", "Licuar la salsa verde de DÍA con la crema. Tortillas rellenas de queso, bañar con la salsa y gratinar.", "Tortilla de maíz:3:pza|Queso manchego / gouda:40:g|Crema:30:g|Salsa verde:150:ml", 13.3, "", "media"],
      ["Molletes de queso con pico de gallo", "Bolillo con frijol y queso, gratinar. Pico de gallo de DÍA encima.", "Pan bolillo:2:pza|Frijol refrito:40:g|Queso manchego / gouda:40:g|Pico de gallo:50:g", 20.46, "salsa", "media"]]],
    ["Atún", [
      ["Tostadas de atún a la mexicana con frijol", "Mezclar atún escurrido con jitomate, cebolla y chile picados y un poco de mayonesa. Tostadas untadas con frijol.", "Atún en lata 140 g:0.5:pza|Jitomate saladet:50:g|Cebolla:20:g|Chile serrano:5:g|Tostada:3:pza|Frijol refrito:40:g|Mayonesa:10:g", 21.09, "salsa", "media"],
      ["Tortitas de papa con atún con arroz", "Puré de papa con atún y huevo, formar tortitas, freír. Salsa verde de DÍA y arroz.", "Atún en lata 140 g:0.5:pza|Papa blanca:150:g|Huevo:0.5:pza|Arroz:50:g|Aceite:20:ml|Salsa verde:100:ml", 25.43, "tortilla", "media"],
      ["Ensalada fría de pasta con atún", "Pasta cocida y fría con atún, mayonesa, elote y zanahoria rallada. Servir sobre lechuga.", "Atún en lata 140 g:0.5:pza|Fusilli (pasta seca):70:g|Mayonesa:25:g|Granos de elote:30:g|Zanahoria:30:g|Mezcla de lechugas:20:g", 20.31, "", "media"],
      ["Atún a la mexicana con arroz", "Sofreír jitomate, cebolla y chile; agregar atún. Arroz aparte.", "Atún en lata 140 g:0.5:pza|Jitomate saladet:60:g|Cebolla:20:g|Chile serrano:5:g|Arroz:60:g|Aceite:10:ml", 21.8, "tortilla", "media"]]],
    ["Chicharrón", [
      ["Chicharrón en salsa verde con frijol", "Hervir el chicharrón en la salsa verde de DÍA 10 min hasta que se suavice. Frijoles aparte.", "Chicharrón:50:g|Frijol refrito:50:g|Salsa verde:180:ml", 17.82, "tortilla", "media"],
      ["Chicharrón en salsa roja con arroz", "Igual que el verde pero en salsa de jitomate. Arroz aparte.", "Chicharrón:50:g|Jitomate saladet:100:g|Chile serrano:5:g|Cebolla:15:g|Arroz:60:g", 18.82, "tortilla", "media"],
      ["Gorditas de chicharrón", "Chicharrón en salsa verde de DÍA, espeso; 3 gorditas rellenas con lechuga y panela.", "Masa de maíz:120:g|Chicharrón:50:g|Mezcla de lechugas:20:g|Queso panela:15:g|Salsa verde:80:ml", 17.91, "salsa", "media"],
      ["Tacos de chicharrón con papa y frijol", "Chicharrón guisado en salsa verde de DÍA con papa en cubo. 4 tacos; frijoles aparte.", "Chicharrón:50:g|Papa blanca:100:g|Tortilla de maíz:3:pza|Salsa verde:100:ml|Frijol refrito:50:g", 16.06, "", "media"]]],
    ["Salchicha", [
      ["Salchichas a la mexicana con arroz", "Salchicha en rodajas dorada con jitomate, cebolla y chile. Arroz aparte.", "Salchicha:75:g|Jitomate saladet:50:g|Cebolla:20:g|Chile serrano:5:g|Arroz:60:g", 14.63, "tortilla", "media"],
      ["Salchichas en chipotle con papa y frijol", "Salsa de jitomate, chipotle y crema; agregar salchicha y papa en cubos precocida. Frijoles aparte.", "Salchicha:75:g|Papa blanca:120:g|Jitomate saladet:60:g|Chipotle (lata):8:g|Crema:20:g|Frijol refrito:50:g", 18.64, "tortilla", "media"],
      ["Burritos de salchicha con frijol y queso", "Salchicha picada con cebolla; 1 burrito grande con frijol refrito y queso, dorar en plancha. (1 tortilla burrera)", "Salchicha:75:g|Tortilla burrera:1:pza|Frijol refrito:50:g|Queso manchego / gouda:20:g|Cebolla:15:g|Salsa tatemada:30:g", 16.84, "", "media"],
      ["Salchichas con verduras salteadas y arroz", "Saltear salchicha con verduras en tiras y ajo. Arroz aparte.", "Salchicha:75:g|Calabaza:60:g|Zanahoria:40:g|Cebolla:20:g|Ajo:2:g|Arroz:60:g|Aceite:10:ml", 15.41, "tortilla", "media"]]]
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
      ["Huevo en salsa roja con tortillas", "2 huevos estrellados o revueltos cocidos en salsa roja.", "Huevo:2:pza|Jitomate saladet:60:g|Cebolla:10:g|Chile serrano:3:g|Tortilla de maíz:2:pza", 9.2, "", "completa"],
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
  produccion: ["Pollo marinado (porción)","Alambre Z","Mezcla veggie","Salsa tatemada","Salsa verde","Totopos","Pico de gallo","Masa wafles","Arrachera (porción)","Chorizo (porción)","Granola"],
  /* Avisos para la lista de mañana */
  avisos: { "Pollo marinado (porción)": "Bolsas de DÍA: con media porción se saca 1 bolsa por cada 2 personas (redondear hacia arriba)", "Tilapia (filete)": "Descongelar un día antes", "Arrachera (porción)": "Registrar la salida como 'personal'", "Alambre Z": "Pedir a DÍA según la porción del platillo", "Chipotle (lata)": "Se calcula con lata de 220 g (confirmar)" },
  /* Liga de cada insumo con el Recetario costeado (i: insumo, r: subreceta) */
  recetario: {"Huevo": "i:huevo", "Tortilla de maíz": "i:tortilla_maiz", "Jitomate saladet": "i:jitomate", "Cebolla": "i:cebolla", "Chile serrano": "i:chile", "Frijol refrito": "i:frijol", "Aceite": "i:aceite", "Arroz": "estimado", "Papa blanca": "i:papa_blanca", "Salsa verde": "r:sr_salsa_verde", "Totopos": "r:sr_totopos", "Crema": "i:crema", "Queso panela": "i:queso_panela", "Pollo marinado (porción)": "r:sr_pollo_marinado", "Pimiento morrón": "i:pimiento", "Chipotle (lata)": "chipotle", "Tostada": "estimado", "Mezcla de lechugas": "i:lechugas", "Fusilli (pasta seca)": "i:fusilli", "Tocino": "i:tocino", "Leche deslactosada": "i:leche", "Knor (consomé)": "i:par_knor_de_res", "Chile poblano": "i:chile_poblano", "Granos de elote": "i:elote", "Calabaza": "i:calabaza", "Zanahoria": "i:zanahoria", "Ajo": "i:ajo", "Puré de tomate": "i:par_pure_de_tomate", "Cerdo en bistec": "estimado", "Mezcla veggie": "r:sr_mezcla_veggie", "Salsa tatemada": "r:sr_salsa_tatemada", "Alambre Z": "r:sr_alambre_z", "Queso manchego / gouda": "i:queso_manchego", "Tortilla burrera": "i:tortilla_burrera", "Masa de maíz": "estimado", "Chorizo (porción)": "r:sr_chorizo", "Tilapia (filete)": "estimado", "Harina de trigo": "i:par_harina_de_trigo", "Mayonesa": "i:par_mayonesa_bote", "Arrachera (porción)": "r:sr_arrachera_porcion", "Jamón": "i:jamon", "Pan bolillo": "i:pan_bolillo", "Aguacate": "i:aguacate", "Carne molida": "i:insumo_tgqc", "Pico de gallo": "r:b_pico", "Atún en lata 140 g": "estimado", "Chicharrón": "estimado", "Salchicha": "estimado", "Avena": "i:par_avena", "Plátano": "i:platano", "Canela": "i:par_canela_bote", "Azúcar": "i:insumo_8wr5", "Manzana": "i:manzana", "Yogurt natural": "i:yogurt", "Papaya": "i:insumo_z6j2", "Miel de abeja": "i:par_miel_de_abeja", "Masa wafles": "r:sr_masa_wafles", "Mantequilla": "i:mantequilla", "Miel de maple": "i:maple", "Caramelo (bote)": "i:par_caramelo_bote", "Granola": "r:sr_granola", "Fresa": "i:fresa", "Pan de caja": "i:pan_caja", "Cereal": "estimado", "Vainilla": "i:par_vainilla", "Chocolate de mesa": "estimado", "Piloncillo": "estimado", "Galletas María": "estimado", "Pan dulce": "estimado", "Fécula de maíz": "i:par_fecula_de_maiz", "Café americano (grano)": "i:par_cafe_americano"}
};
export default CICLO;
