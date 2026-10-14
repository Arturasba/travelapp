// Primary visitor services checked on 14 October 2026. Timetables and fares stay with their operators.
import type { Locale } from "./locale";
export const travelResources = [
  { title: "Train journeys", description: "Look up train routes, current timetables and tickets with LTG Link.", label: "LTG Link", url: "https://ltglink.lt/en" },
  { title: "Intercity buses", description: "Search bus journeys between towns and check available tickets for your travel date.", label: "Autobusų bilietai", url: "https://www.autobusubilietai.lt/en" },
  { title: "The Curonian Spit ferry", description: "Check Klaipėda–Smiltynė crossings, terminal information and tickets before heading to the spit.", label: "Smiltynės Perkėla", url: "https://keltas.lt/en/" },
  { title: "Weather for your day", description: "Check local forecasts before a walk, a beach day or a longer outdoor trip.", label: "Lithuanian weather service", url: "https://www.meteo.lt/en/" },
  { title: "More local knowledge", description: "Explore Lithuania’s national tourism guide for more destinations and trip inspiration.", label: "Lithuania Travel", url: "https://lithuania.travel/en" },
] as const;

const lithuanianResources = [
  {title:"Kelionės traukiniu",description:"LTG Link svetainėje rasite maršrutus, aktualius tvarkaraščius ir bilietus.",label:"LTG Link",url:"https://ltglink.lt/"},
  {title:"Tarpmiestiniai autobusai",description:"Ieškokite kelionių tarp miestų ir tikrinkite bilietus pasirinktai kelionės dienai.",label:"Autobusų bilietai",url:"https://www.autobusubilietai.lt/"},
  {title:"Keltas į Kuršių neriją",description:"Prieš vykdami į neriją tikrinkite Klaipėdos–Smiltynės keltų maršrutus, prieplaukas ir bilietus.",label:"Smiltynės perkėla",url:"https://keltas.lt/"},
  {title:"Dienos orų prognozė",description:"Prieš pasivaikščiojimą, dieną paplūdimyje ar ilgesnę išvyką tikrinkite vietos orų prognozę.",label:"Lietuvos hidrometeorologijos tarnyba",url:"https://www.meteo.lt/"},
  {title:"Daugiau idėjų kelionei",description:"Nacionaliniame turizmo gide atraskite daugiau vietų ir kelionių idėjų.",label:"Keliauk Lietuvoje",url:"https://lithuania.travel/lt"},
] as const;
export function getTravelResources(locale:Locale){return locale==="lt"?lithuanianResources:travelResources;}
