import type { ProductOptionConfig } from "./product-options";

export const YUKI_MENU_VERSION="2026-09";
export const YUKI_VIRTUAL_STOCK=1_000_000;

export type YukiIngredientDefinition={
  key:string;
  id:string;
  name:string;
  unit:string;
  trackStock:boolean;
  lowStockThreshold:number;
};

export type YukiMenuDefinition={
  slug:string;
  id:string;
  barcode:string;
  name:string;
  category:string;
  price:number;
  description:string;
  recipe:string[];
  optionConfig?:ProductOptionConfig;
};

const ingredient=(key:string,name:string,unit="porción",trackStock=false,lowStockThreshold=5):YukiIngredientDefinition=>({
  key,id:`yuki-ingredient-${key}`,name,unit,trackStock,lowStockThreshold,
});

// Los insumos que YUKI ya controla conservan sus registros reales en Cloud.
// Estos ids estables se usan para una instalación local nueva y como respaldo
// para los ingredientes nuevos creados por la migración productiva.
export const YUKI_INGREDIENTS:YukiIngredientDefinition[]=[
  ingredient("yogurt-natural","Yogurt Natural","porción",true),
  ingredient("pulpa-mora","Pulpa de Mora","porción",true),
  ingredient("pulpa-fresa","Pulpa de Fresa","porción",true),
  ingredient("pulpa-melon","Pulpa de Melón","porción",true),
  ingredient("pulpa-tomate-arbol","Pulpa de Tomate de árbol","porción",true),
  ingredient("banana","Banana","unidad",true),
  ingredient("pulpa-naranjilla","Pulpa de Naranjilla","porción",true),
  ingredient("pulpa-maracuya","Pulpa de Maracuyá","porción",true),
  ingredient("pulpa-mango","Pulpa de Mango","porción",true),
  ingredient("pulpa-pina","Pulpa de Piña","porción",true),
  ingredient("pulpa-coco","Pulpa de Coco","porción",true),
  ingredient("pan-yuca","Pan de Yuca","unidad",true),
  ingredient("baguette","Baguette","unidad",true),
  ingredient("pollo-porcion","Pollo porción"),
  ingredient("carne-porcion","Carne porción"),
  ingredient("salsa-queso-tocino","Salsa de queso con tocino"),
  ingredient("queso-holandes","Queso holandés"),
  ingredient("tomate-confitado","Tomate confitado"),
  ingredient("salsa-casa","Salsa de la casa"),
  ingredient("queso-cheddar","Queso cheddar"),
  ingredient("cebolla-semicaramelizada","Cebolla semicaramelizada"),
  ingredient("hojas-albahaca","Hojas de albahaca"),
  ingredient("cafe-porcion","Café preparado"),
  ingredient("leche-porcion","Leche"),
  ingredient("te-porcion","Té / infusión"),
  ingredient("colas","Cola","unidad",true),
  ingredient("agua-gas","Agua con gas","unidad",true),
];

const menu=(slug:string,name:string,category:string,price:number,description:string,recipe:string[]=[],optionConfig?:ProductOptionConfig):YukiMenuDefinition=>({
  slug,id:`yuki-menu-${slug}`,barcode:`YUKI-${slug.replace(/-/g,"").slice(0,22).toUpperCase()}`,name,category,price,description,recipe,optionConfig,
});

const yogurt=(slug:string,name:string,ingredientKey:string)=>menu(`yogurt-${slug}`,`Yogurt ${name}`,"Yogurts",4.50,`Yogurt natural con ${name.toLocaleLowerCase("es")}.`,["yogurt-natural",ingredientKey]);

export const YUKI_MENU:YukiMenuDefinition[]=[
  yogurt("mora","Mora","pulpa-mora"),
  yogurt("fresa","Fresa","pulpa-fresa"),
  yogurt("melon","Melón","pulpa-melon"),
  yogurt("tomate-arbol","Tomate de árbol","pulpa-tomate-arbol"),
  yogurt("banana","Banana","banana"),
  yogurt("naranjilla","Naranjilla","pulpa-naranjilla"),
  yogurt("maracuya","Maracuyá","pulpa-maracuya"),
  yogurt("mango","Mango","pulpa-mango"),
  yogurt("pina","Piña","pulpa-pina"),
  yogurt("coco","Coco","pulpa-coco"),
  menu("combo-1","Combo 1","Combos",5.80,"1 yogurt + 3 panes de yuca.",["pan-yuca","pan-yuca","pan-yuca"],{label:"Yogur",selectionCount:1,source:"category",sourceCategory:"Yogurts",allowRepeat:true}),
  menu("combo-2","Combo 2","Combos",7.60,"1 yogurt + 6 panes de yuca.",Array(6).fill("pan-yuca"),{label:"Yogur",selectionCount:1,source:"category",sourceCategory:"Yogurts",allowRepeat:true}),
  menu("combo-3","Combo 3","Combos",13.95,"2 yogurts + 10 panes de yuca.",Array(10).fill("pan-yuca"),{label:"Yogur",selectionCount:2,source:"category",sourceCategory:"Yogurts",allowRepeat:true}),
  menu("combo-4","Combo 4","Combos",21,"3 yogurts + 15 panes de yuca.",Array(15).fill("pan-yuca"),{label:"Yogur",selectionCount:3,source:"category",sourceCategory:"Yogurts",allowRepeat:true}),
  menu("sandwich-pollo-cremoso","Pollo Cremoso","Sánduches",8.95,"Salsa de queso con tocino, queso holandés, pollo, tomate confitado y salsa de la casa.",["baguette","pollo-porcion","salsa-queso-tocino","queso-holandes","tomate-confitado","salsa-casa"]),
  menu("sandwich-carne-brava","Carne Brava","Sánduches",9.90,"Carne de res, queso cheddar, cebolla semicaramelizada y salsa de la casa.",["baguette","carne-porcion","queso-cheddar","cebolla-semicaramelizada","salsa-casa"]),
  menu("sandwich-la-fresca","La Fresca","Sánduches",7.75,"Queso holandés, tomate confitado, hojas de albahaca y salsa de la casa.",["baguette","queso-holandes","tomate-confitado","hojas-albahaca","salsa-casa"]),
  menu("cafe-americano","Café americano caliente / frío","Bebidas",3.25,"Café americano caliente o frío.",["cafe-porcion"]),
  menu("cappuccino","Capuccino","Bebidas",3.75,"Café capuccino.",["cafe-porcion","leche-porcion"]),
  menu("espresso","Espresso","Bebidas",3,"Café espresso.",["cafe-porcion"]),
  menu("te","Té","Bebidas",3,"Té o infusión.",["te-porcion"]),
  menu("jugo-frutas","Jugo de frutas","Bebidas",3.50,"Jugo de frutas; el sabor se elige al vender.",[],{label:"Sabor",selectionCount:1,source:"category",sourceCategory:"Jugos",allowRepeat:false}),
  menu("colas","Colas","Bebidas",2.25,"Bebida gaseosa.",["colas"]),
  menu("agua-gas","Agua con gas (Güitig)","Bebidas",2.65,"Agua mineral con gas.",["agua-gas"]),
];

export const YUKI_MENU_BY_ID=new Map(YUKI_MENU.map(item=>[item.id,item]));
export const YUKI_INGREDIENT_BY_KEY=new Map(YUKI_INGREDIENTS.map(item=>[item.key,item]));
