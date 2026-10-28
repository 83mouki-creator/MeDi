/**
 * Données de démonstration MeDi — CLIQUEMENT IDENTIFIÉES COMME DÉMO.
 *
 * Ce script ne crée AUCUNE information commerciale réelle : numéros de téléphone,
 * adresse et horaires restent vides (le propriétaire doit les saisir dans
 * /admin/parametres). Les tarifs de livraison sont des valeurs de travail
 * marquées « (DÉMO) » à remplacer par le barème de la boutique.
 *
 *   npm run db:seed
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { eq, sql } from 'drizzle-orm';
import { db, pool } from '../src/db';
import {
  brands,
  categories,
  deliveryZones,
  productAttributes,
  productImages,
  products,
  storeSettings,
  suppliers,
  users,
} from '../src/db/schema';
import { buildSearchText } from '../src/lib/catalog';
import { hashPassword, verifyPassword } from '../src/lib/auth';
import { newId, slugify } from '../src/lib/utils';
import { normalizeText } from '../src/lib/utils';

const DEMO_PREFIX = '[DÉMO]';

type SeedProduct = {
  name: string;
  category: string;
  brand?: string;
  price: number;
  promo?: number;
  stock: number;
  short: string;
  description: string;
  keywords: string[];
  attributes: Record<string, string>;
  featured?: boolean;
};

const CATEGORIES: { slug: string; name: string; description: string; children?: { slug: string; name: string }[] }[] = [
  {
    slug: 'outillage-industriel',
    name: 'Outillage industriel',
    description: 'Perceuses, meuleuses, scies et outillage professionnel pour ateliers et chantiers.',
    children: [
      { slug: 'outillage-electroportatif', name: 'Outillage électroportatif' },
      { slug: 'outillage-a-main', name: 'Outillage à main' },
    ],
  },
  {
    slug: 'materiel-de-construction',
    name: 'Matériel de construction',
    description: 'Ciment, fer à béton, agrégats et fournitures de chantier.',
    children: [
      { slug: 'materiaux-de-base', name: 'Matériaux de base' },
      { slug: 'peinture-finitions', name: 'Peinture et finitions' },
    ],
  },
  {
    slug: 'quincaillerie',
    name: 'Quincaillerie',
    description: 'Serrurerie, visserie, robinetterie et petites fournitures.',
    children: [
      { slug: 'serrurerie', name: 'Serrurerie' },
      { slug: 'visserie-fixation', name: 'Visserie et fixation' },
      { slug: 'plomberie', name: 'Plomberie' },
    ],
  },
  {
    slug: 'equipements-techniques',
    name: 'Équipements techniques',
    description: 'Pompes, groupes électrogènes, nettoyeurs et machines.',
    children: [{ slug: 'motopompes', name: 'Motopompes et surpresseurs' }],
  },
  {
    slug: 'electromenager',
    name: 'Électroménager',
    description: 'Réfrigérateurs, ventilateurs, cuisinières et petit électroménager.',
  },
  {
    slug: 'maison-interieur-exterieur',
    name: 'Maison et extérieur',
    description: 'Articles pour l’intérieur et l’extérieur de la maison.',
  },
];

const BRANDS = [
  { slug: 'nasco', name: 'Nasco', description: 'Électroménager et équipement domestique.' },
  { slug: 'bosch', name: 'Bosch', description: 'Outillage professionnel.' },
  { slug: 'makita', name: 'Makita', description: 'Outillage électroportatif.' },
  { slug: 'karcher', name: 'Kärcher', description: 'Nettoyage haute pression.' },
  { slug: 'ingco', name: 'Ingco', description: 'Outillage et quincaillerie.' },
  { slug: 'dangote', name: 'Dangote', description: 'Ciment.' },
  { slug: 'medi-pro', name: 'MeDi Pro', description: 'Sélection de la boutique MeDi.' },
];

const SUPPLIERS = [
  { name: 'Fournisseur Daloa Centre (démo)', contact: 'À compléter' },
  { name: 'Grossiste Abidjan (démo)', contact: 'À compléter' },
  { name: 'Import direct (démo)', contact: 'À compléter' },
];

const PRODUCTS: SeedProduct[] = [
  // Outillage électroportatif
  { name: 'Perceuse à percussion 850 W', category: 'outillage-electroportatif', brand: 'bosch', price: 78500, promo: 69900, stock: 12, short: 'Perceuse filaire 850 W, mandrin 13 mm, variateur de vitesse.', description: 'Perceuse à percussion robuste pour le bois, le métal et la maçonnerie légère. Mandrin autoserrant 13 mm, poignée auxiliaire, coffret de transport.', keywords: ['perceuse', 'perforateur', 'bricolage', 'chantier'], attributes: { Puissance: '850 W', Mandrin: '13 mm', 'Vitesse à vide': '0–3000 tr/min', Alimentation: '230 V' }, featured: true },
  { name: 'Meuleuse d’angle 125 mm 900 W', category: 'outillage-electroportatif', brand: 'makita', price: 52000, stock: 8, short: 'Meuleuse 900 W pour découpe et ébarbage du métal.', description: 'Meuleuse compacte avec carter réglable, poignée latérale et protection contre les surcharges. Idéale pour les ateliers de soudure.', keywords: ['meuleuse', 'disqueuse', 'metal'], attributes: { Puissance: '900 W', Diamètre: '125 mm', 'Vitesse': '11 000 tr/min' } },
  { name: 'Visseuse sans fil 18 V + 2 batteries', category: 'outillage-electroportatif', brand: 'ingco', price: 64500, stock: 6, short: 'Visseuse 18 V, 2 batteries lithium, chargeur rapide.', description: 'Couple de 45 Nm, deux vitesses, mandrin 13 mm, éclairage LED. Livrée en coffret avec deux batteries et un chargeur.', keywords: ['visseuse', 'perceuse sans fil', 'batterie'], attributes: { Tension: '18 V', Couple: '45 Nm', Batteries: '2 × 2,0 Ah' } },
  { name: 'Scie circulaire 1400 W 185 mm', category: 'outillage-electroportatif', brand: 'bosch', price: 98000, stock: 4, short: 'Scie circulaire professionnelle, lame 185 mm.', description: 'Scie circulaire pour bois et panneaux, guide parallèle, aspiration des copeaux, capot de protection.', keywords: ['scie', 'circulaire', 'bois'], attributes: { Puissance: '1400 W', Lame: '185 mm', 'Profondeur de coupe': '65 mm' } },
  { name: 'Marteau piqueur 1500 W', category: 'outillage-electroportatif', brand: 'ingco', price: 145000, stock: 3, short: 'Marteau piqueur SDS-Max pour démolition.', description: 'Marteau piqueur puissant pour la démolition du béton et des dalles. Poignée antivibration, embouts SDS-Max.', keywords: ['marteau piqueur', 'demolition', 'beton'], attributes: { Puissance: '1500 W', 'Énergie de frappe': '25 J', Mandrin: 'SDS-Max' } },
  { name: 'Jeu de tournevis 12 pièces isolés', category: 'outillage-a-main', brand: 'ingco', price: 9500, stock: 25, short: 'Tournevis isolés 1000 V, 12 pièces.', description: 'Jeu de tournevis plats et cruciformes isolés pour travaux électriques, poignées ergonomiques antidérapantes.', keywords: ['tournevis', 'electricite', 'outillage main'], attributes: { Pièces: '12', Isolation: '1000 V' } },
  { name: 'Clé à molette 12 pouces', category: 'outillage-a-main', brand: 'medi-pro', price: 6500, stock: 30, short: 'Clé à molette acier forgé, ouverture 34 mm.', description: 'Clé à molette en acier forgé, mâchoires trempées, finition chromée.', keywords: ['cle', 'molette', 'mecanique'], attributes: { Taille: '12"', Ouverture: '34 mm' } },
  { name: 'Coffret douilles 1/2" 24 pièces', category: 'outillage-a-main', brand: 'ingco', price: 24500, stock: 9, short: 'Coffret de douilles et cliquet 1/2".', description: 'Coffret complet avec cliquet réversible, rallonges et douilles de 10 à 32 mm, en mallette métallique.', keywords: ['douille', 'cliquet', 'coffret'], attributes: { Pièces: '24', Entraînement: '1/2"' } },

  // Construction
  { name: 'Ciment CPJ 35 — sac de 50 kg', category: 'materiaux-de-base', brand: 'dangote', price: 5200, stock: 400, short: 'Sac de ciment 50 kg pour maçonnerie et béton.', description: 'Ciment portland composé CPJ 35, adapté aux travaux de maçonnerie, dalles et enduits. Vendu au sac de 50 kg.', keywords: ['ciment', 'sac', 'construction', 'beton'], attributes: { Conditionnement: '50 kg', Type: 'CPJ 35' }, featured: true },
  { name: 'Fer à béton 8 mm — barre 12 m', category: 'materiaux-de-base', price: 3800, stock: 250, short: 'Barre de fer à béton torsadé 8 mm, 12 m.', description: 'Fer à béton HA 8 mm pour armatures de dalles et poteaux. Barre de 12 mètres.', keywords: ['fer', 'beton', 'armature'], attributes: { Diamètre: '8 mm', Longueur: '12 m' } },
  { name: 'Treillis soudé 2,4 × 1,2 m', category: 'materiaux-de-base', price: 11500, stock: 40, short: 'Panneau de treillis soudé pour dalle.', description: 'Treillis soudé galvanisé pour renfort de dallage, maille 150 × 150 mm.', keywords: ['treillis', 'soude', 'dalle'], attributes: { Dimensions: '2,4 × 1,2 m', Maille: '150 × 150 mm' } },
  { name: 'Peinture acrylique blanche 20 L', category: 'peinture-finitions', price: 32500, promo: 29900, stock: 18, short: 'Peinture acrylique mate intérieure/extérieure, 20 L.', description: 'Peinture acrylique mate lessivable, forte opacité, pour murs intérieurs et façades. Seau de 20 litres.', keywords: ['peinture', 'blanc', 'mur', 'facade'], attributes: { Contenance: '20 L', Finition: 'Mate', Usage: 'Intérieur/extérieur' } },
  { name: 'Carreaux grès 60 × 60 cm (m²)', category: 'peinture-finitions', price: 7500, stock: 320, short: 'Carreaux grès cérame 60 × 60, vendu au m².', description: 'Carreaux grès cérame pour sols, aspect marbre clair, résistant à l’usure. Prix au mètre carré.', keywords: ['carreaux', 'gres', 'sol'], attributes: { Format: '60 × 60 cm', 'Prix au': 'm²' } },
  { name: 'Tôle bac alu 0,30 mm', category: 'materiaux-de-base', price: 8900, stock: 60, short: 'Tôle bac alu pour toiture, longueur 3 m.', description: 'Tôle bac alu nervurée pour couverture, épaisseur 0,30 mm, longueur 3 mètres.', keywords: ['tole', 'toiture', 'bac'], attributes: { Épaisseur: '0,30 mm', Longueur: '3 m' } },
  { name: 'Grillage soudé 1 m × 25 m', category: 'materiaux-de-base', price: 27500, stock: 15, short: 'Grillage soudé galvanisé pour clôture.', description: 'Rouleau de grillage soudé galvanisé, hauteur 1 m, longueur 25 m.', keywords: ['grillage', 'cloture', 'soude'], attributes: { Hauteur: '1 m', Longueur: '25 m' } },

  // Quincaillerie
  { name: 'Cadenas laiton 50 mm', category: 'serrurerie', price: 3500, stock: 45, short: 'Cadenas laiton avec 3 clés.', description: 'Cadenas en laiton massif, anse trempée, livré avec trois clés.', keywords: ['cadenas', 'serrure', 'securite'], attributes: { Taille: '50 mm', Clés: '3' } },
  { name: 'Serrure encastrable à cylindre', category: 'serrurerie', price: 12500, stock: 20, short: 'Serrure de porte encastrable, cylindre européen.', description: 'Serrure à mortaiser pour porte bois, cylindre européen, pêne dormant et demi-tour.', keywords: ['serrure', 'porte', 'cylindre'], attributes: { Type: 'Encastrable', Cylindre: 'Européen' } },
  { name: 'Charnière inox 100 mm (paire)', category: 'serrurerie', price: 2500, stock: 80, short: 'Paire de charnières inox pour porte et portail.', description: 'Charnières en acier inoxydable, résistantes à la corrosion, visserie incluse.', keywords: ['charniere', 'inox', 'porte'], attributes: { Taille: '100 mm', Matière: 'Inox' } },
  { name: 'Vis à bois 5 × 50 mm — boîte de 200', category: 'visserie-fixation', price: 4500, stock: 60, short: 'Boîte de 200 vis à bois tête fraisée.', description: 'Vis à bois tête fraisée, acier zingué, empreinte cruciforme. Boîte de 200 unités.', keywords: ['vis', 'bois', 'visserie'], attributes: { Dimensions: '5 × 50 mm', Quantité: '200' } },
  { name: 'Chevilles nylon 8 mm — sachet de 100', category: 'visserie-fixation', price: 2200, stock: 90, short: 'Chevilles à expansion pour béton et brique.', description: 'Chevilles nylon avec vis, pour fixation dans la maçonnerie pleine et creuse. Sachet de 100.', keywords: ['cheville', 'fixation', 'beton'], attributes: { Diamètre: '8 mm', Quantité: '100' } },
  { name: 'Câble électrique souple 2,5 mm² — 100 m', category: 'visserie-fixation', price: 38500, stock: 22, short: 'Couronne de câble souple 3G2,5, 100 m.', description: 'Câble électrique souple cuivre 3 conducteurs 2,5 mm², gaine PVC, couronne de 100 mètres.', keywords: ['cable', 'electrique', 'cuivre'], attributes: { Section: '3G2,5 mm²', Longueur: '100 m' } },
  { name: 'Interrupteur simple encastré', category: 'visserie-fixation', price: 1800, stock: 120, short: 'Interrupteur blanc encastré 10 A.', description: 'Interrupteur simple allumage encastré, plastique blanc, 10 A / 250 V.', keywords: ['interrupteur', 'electrique'], attributes: { Courant: '10 A', Montage: 'Encastré' } },
  { name: 'Prise 16 A avec terre', category: 'visserie-fixation', price: 2100, stock: 110, short: 'Prise encastrée 16 A 2P+T.', description: 'Prise de courant encastrée avec terre, 16 A, conforme aux installations domestiques.', keywords: ['prise', 'electrique', '16a'], attributes: { Courant: '16 A', Type: '2P+T' } },
  { name: 'Robinet mitigeur lavabo chromé', category: 'plomberie', price: 16500, stock: 14, short: 'Mitigeur mono-commande pour lavabo.', description: 'Mitigeur chromé à cartouche céramique, flexibles inclus, pour lavabo.', keywords: ['robinet', 'mitigeur', 'plomberie'], attributes: { Finition: 'Chromé', Cartouche: 'Céramique' } },
  { name: 'Tuyau PVC pression Ø 32 mm — 6 m', category: 'plomberie', price: 7200, stock: 35, short: 'Tube PVC pression 32 mm, barre de 6 m.', description: 'Tube PVC rigide pour adduction d’eau, diamètre 32 mm, longueur 6 mètres.', keywords: ['pvc', 'tuyau', 'eau'], attributes: { Diamètre: '32 mm', Longueur: '6 m' } },
  { name: 'Flexible de douche inox 1,5 m', category: 'plomberie', price: 3200, stock: 50, short: 'Flexible tressé inox pour douche.', description: 'Flexible de douche tressé inox, longueur 1,5 m, raccords 1/2".', keywords: ['flexible', 'douche', 'inox'], attributes: { Longueur: '1,5 m' } },

  // Équipements techniques
  { name: 'Motopompe thermique 2"', category: 'motopompes', brand: 'medi-pro', price: 165000, stock: 5, short: 'Pompe à eau thermique 6,5 CV, refoulement 2".', description: 'Motopompe thermique essence pour irrigation et chantier, débit 30 m³/h, hauteur 30 m.', keywords: ['pompe', 'motopompe', 'irrigation', 'eau'], attributes: { Puissance: '6,5 CV', Refoulement: '2"', 'Débit': '30 m³/h' } },
  { name: 'Surpresseur 800 W', category: 'motopompes', price: 89000, stock: 7, short: 'Surpresseur automatique 800 W pour maison.', description: 'Surpresseur électrique avec réservoir 24 L, pressostat automatique, idéal pour améliorer la pression domestique.', keywords: ['surpresseur', 'pompe', 'pression'], attributes: { Puissance: '800 W', Réservoir: '24 L' } },
  { name: 'Groupe électrogène 3,5 kVA', category: 'equipements-techniques', price: 385000, stock: 3, short: 'Groupe électrogène essence 3,5 kVA, démarrage manuel.', description: 'Groupe électrogène monophasé 3,5 kVA, réservoir 15 L, protection contre les surcharges. Idéal boutique et maison.', keywords: ['groupe electrogene', 'courant', 'electricite'], attributes: { Puissance: '3,5 kVA', Carburant: 'Essence', Réservoir: '15 L' }, featured: true },
  { name: 'Nettoyeur haute pression 130 bar', category: 'equipements-techniques', brand: 'karcher', price: 185000, promo: 169000, stock: 4, short: 'Nettoyeur haute pression 130 bar, 1800 W.', description: 'Nettoyeur haute pression pour véhicules et façades, lance réglable, tuyau 7 m.', keywords: ['karcher', 'nettoyeur', 'haute pression'], attributes: { Pression: '130 bar', Puissance: '1800 W' } },
  { name: 'Poste à souder MMA 200 A', category: 'equipements-techniques', price: 125000, stock: 6, short: 'Poste à souder à l’arc 200 A, 230 V.', description: 'Poste à souder MMA avec câbles et masque, pour électrodes de 1,6 à 4 mm.', keywords: ['soudure', 'poste', 'arc'], attributes: { Intensité: '200 A', Alimentation: '230 V' } },
  { name: 'Compresseur d’air 50 L 2 CV', category: 'equipements-techniques', price: 175000, stock: 3, short: 'Compresseur à air 50 L, 2 CV, 8 bar.', description: 'Compresseur d’atelier avec cuve 50 L, pressostat, pour outils pneumatiques et peinture.', keywords: ['compresseur', 'air', 'atelier'], attributes: { Cuve: '50 L', Puissance: '2 CV', Pression: '8 bar' } },
  { name: 'Débroussailleuse thermique 2 temps', category: 'equipements-techniques', price: 98000, stock: 6, short: 'Débroussailleuse 43 cc, lame et tête nylon.', description: 'Débroussailleuse thermique pour entretien de terrains, harnais fourni, lame métallique et tête nylon.', keywords: ['debroussailleuse', 'jardin', 'entretien'], attributes: { Cylindrée: '43 cc', 'Type': '2 temps' } },

  // Électroménager
  { name: 'Réfrigérateur combiné 200 L Nasco', category: 'electromenager', brand: 'nasco', price: 245000, promo: 229000, stock: 8, short: 'Réfrigérateur combiné 200 L, classe A+.', description: 'Réfrigérateur combiné avec congélateur, 200 litres utiles, clayettes réglables, faible consommation. Garantie 12 mois.', keywords: ['refrigerateur', 'frigo', 'nasco', 'cuisine'], attributes: { Capacité: '200 L', Classe: 'A+', Garantie: '12 mois' }, featured: true },
  { name: 'Congélateur coffre 300 L Nasco', category: 'electromenager', brand: 'nasco', price: 295000, stock: 4, short: 'Congélateur coffre 300 L, congélation rapide.', description: 'Congélateur coffre pour commerce et famille, 300 litres, panier amovible, serrure.', keywords: ['congelateur', 'nasco', 'froid'], attributes: { Capacité: '300 L', Type: 'Coffre' } },
  { name: 'Ventilateur brasseur 18 pouces', category: 'electromenager', brand: 'nasco', price: 28500, stock: 20, short: 'Ventilateur brasseur 18", 3 vitesses.', description: 'Ventilateur sur pied, hauteur réglable, 3 vitesses, oscillation. Adapté aux fortes chaleurs.', keywords: ['ventilateur', 'brasseur', 'ventilation'], attributes: { Diamètre: '18"', Vitesses: '3' }, featured: true },
  { name: 'Climatiseur split 1,5 CV', category: 'electromenager', brand: 'nasco', price: 385000, stock: 5, short: 'Climatiseur split inverter 1,5 CV avec kit.', description: 'Climatiseur split 12 000 BTU, technologie inverter, télécommande et kit d’installation inclus.', keywords: ['climatiseur', 'split', 'clim'], attributes: { Puissance: '1,5 CV', Technologie: 'Inverter' } },
  { name: 'Cuisinière 4 feux avec four', category: 'electromenager', brand: 'nasco', price: 315000, stock: 3, short: 'Cuisinière gaz 4 feux, four et gril.', description: 'Cuisinière à gaz avec four, gril, allumage électronique et sécurité thermocouple.', keywords: ['cuisiniere', 'gaz', 'cuisine'], attributes: { Feux: '4', Four: 'Oui' } },
  { name: 'Micro-ondes 20 L', category: 'electromenager', brand: 'nasco', price: 68500, stock: 10, short: 'Micro-ondes 20 L, 700 W, 5 niveaux.', description: 'Four micro-ondes compact, 700 W, minuterie 30 minutes, plateau tournant.', keywords: ['micro-ondes', 'cuisine'], attributes: { Capacité: '20 L', Puissance: '700 W' } },
  { name: 'Fer à repasser vapeur 2200 W', category: 'electromenager', brand: 'nasco', price: 18500, stock: 15, short: 'Fer à repasser vapeur, semelle céramique.', description: 'Fer à repasser 2200 W avec jet de vapeur, semelle céramique anti-adhérente.', keywords: ['fer', 'repassage', 'vapeur'], attributes: { Puissance: '2200 W', Semelle: 'Céramique' } },
  { name: 'Bouilloire électrique 1,7 L', category: 'electromenager', brand: 'nasco', price: 12500, stock: 18, short: 'Bouilloire inox 1,7 L, arrêt automatique.', description: 'Bouilloire électrique 2200 W, corps inox, arrêt automatique et base rotative.', keywords: ['bouilloire', 'the', 'cuisine'], attributes: { Capacité: '1,7 L', Puissance: '2200 W' } },

  // Maison et extérieur
  { name: 'Marmite aluminium 20 L', category: 'maison-interieur-exterieur', price: 22500, stock: 12, short: 'Marmite aluminium avec couvercle, 20 L.', description: 'Marmite en aluminium épais avec couvercle, poignées renforcées. Idéale pour grandes préparations.', keywords: ['marmite', 'cuisine', 'aluminium'], attributes: { Capacité: '20 L' } },
  { name: 'Chaise plastique renforcée', category: 'maison-interieur-exterieur', price: 7500, stock: 60, short: 'Chaise plastique empilable, usage intérieur/extérieur.', description: 'Chaise monobloc en polypropylène renforcé, empilable, résistante au soleil.', keywords: ['chaise', 'plastique', 'exterieur'], attributes: { Matière: 'Polypropylène', Empilable: 'Oui' } },
  { name: 'Table plastique 6 places', category: 'maison-interieur-exterieur', price: 32500, stock: 10, short: 'Table pliante 6 places, 180 cm.', description: 'Table en plastique pliante, structure métal, 6 places, pour réceptions et extérieur.', keywords: ['table', 'plastique', 'reception'], attributes: { Places: '6', Longueur: '180 cm' } },
  { name: 'Matelas mousse 140 × 190 cm', category: 'maison-interieur-exterieur', price: 78500, stock: 6, short: 'Matelas mousse haute densité 140 × 190.', description: 'Matelas en mousse haute densité, housse déhoussable, épaisseur 15 cm.', keywords: ['matelas', 'lit', 'mousse'], attributes: { Dimensions: '140 × 190 cm', Épaisseur: '15 cm' } },
  { name: 'Ventilateur plafond 3 pales', category: 'maison-interieur-exterieur', price: 34500, stock: 8, short: 'Ventilateur de plafond silencieux, 3 pales.', description: 'Ventilateur de plafond avec régulateur de vitesse, moteur silencieux, design sobre.', keywords: ['ventilateur', 'plafond'], attributes: { Pales: '3', Commande: 'Cordon' } },
  { name: 'Coussin décoratif 45 × 45 cm', category: 'maison-interieur-exterieur', price: 4500, stock: 40, short: 'Coussin déhoussable, tissu coton.', description: 'Coussin décoratif 45 × 45 cm, housse déhoussable lavable, garnissage fibres.', keywords: ['coussin', 'decoration', 'salon'], attributes: { Dimensions: '45 × 45 cm' } },
];

async function ensurePlaceholderImage(params: { name: string; sku: string; index: number; tone: string }) {
  const dir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(dir, { recursive: true });

  const palettes = [
    { bg: '#0E2340', accent: '#F97316', text: '#FFFFFF' },
    { bg: '#F1F5FB', accent: '#23446E', text: '#0E2340' },
  ];
  const palette = palettes[params.index % palettes.length]!;
  const label = params.name.length > 46 ? `${params.name.slice(0, 45)}…` : params.name;

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900">
    <rect width="900" height="900" fill="${palette.bg}"/>
    <circle cx="740" cy="150" r="190" fill="${palette.accent}" opacity="0.16"/>
    <circle cx="130" cy="780" r="150" fill="${palette.accent}" opacity="0.12"/>
    <rect x="70" y="300" width="760" height="300" rx="28" fill="${palette.bg}" stroke="${palette.accent}" stroke-width="4" opacity="0.98"/>
    <text x="450" y="410" font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="700"
      fill="${palette.text}" text-anchor="middle">${escapeXml(label)}</text>
    <text x="450" y="470" font-family="Helvetica, Arial, sans-serif" font-size="26" font-weight="600"
      fill="${palette.accent}" text-anchor="middle">Réf. ${escapeXml(params.sku)}</text>
    <text x="450" y="560" font-family="Helvetica, Arial, sans-serif" font-size="22"
      fill="${palette.text}" opacity="0.75" text-anchor="middle">Photo de démonstration — à remplacer</text>
    <text x="450" y="830" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="800"
      fill="${palette.text}" opacity="0.9" text-anchor="middle">MeDi</text>
  </svg>`;

  const buffer = await sharp(Buffer.from(svg))
    .resize(900, 900)
    .flatten({ background: palette.bg })
    .webp({ quality: 78 })
    .toBuffer();

  const filename = `demo-${slugify(params.sku)}-${params.index + 1}.webp`;
  await writeFile(path.join(dir, filename), buffer);

  return {
    url: `/uploads/${filename}`,
    checksum: createHash('sha256').update(buffer).digest('hex'),
    width: 900,
    height: 900,
  };
}

function escapeXml(input: string) {
  return input.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

async function main() {
  console.log('→ Données de démonstration MeDi');

  // Réglages boutique (aucune donnée commerciale inventée)
  await db
    .insert(storeSettings)
    .values({ id: 1, storeName: 'MeDi', tagline: null, city: 'Daloa', country: "Côte d'Ivoire", waveMode: 'MANUAL', allowCod: false, allowPickup: true, allowLocalDelivery: true, lowStockThreshold: 5, reservationMinutes: 120 })
    .onConflictDoNothing();

  // Catégories
  const categoryIds = new Map<string, string>();
  for (const [index, category] of CATEGORIES.entries()) {
    const id = `cat_${category.slug}`;
    await db
      .insert(categories)
      .values({ id, slug: category.slug, name: category.name, description: category.description, position: index })
      .onConflictDoUpdate({ target: categories.slug, set: { name: category.name, description: category.description, position: index } });
    categoryIds.set(category.slug, id);

    for (const [childIndex, child] of (category.children ?? []).entries()) {
      const childId = `cat_${child.slug}`;
      await db
        .insert(categories)
        .values({ id: childId, slug: child.slug, name: child.name, parentId: id, position: childIndex })
        .onConflictDoUpdate({ target: categories.slug, set: { name: child.name, parentId: id, position: childIndex } });
      categoryIds.set(child.slug, childId);
    }
  }

  // Marques
  const brandIds = new Map<string, string>();
  for (const brand of BRANDS) {
    const id = `brd_${brand.slug}`;
    await db
      .insert(brands)
      .values({ id, slug: brand.slug, name: brand.name, description: brand.description })
      .onConflictDoUpdate({ target: brands.slug, set: { name: brand.name, description: brand.description } });
    brandIds.set(brand.slug, id);
  }

  // Fournisseurs
  for (const supplier of SUPPLIERS) {
    const existing = await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.name, supplier.name)).limit(1);
    if (existing.length === 0) {
      await db.insert(suppliers).values({ id: newId('sup_'), name: supplier.name, contact: supplier.contact });
    }
  }
  const supplierRows = await db.select({ id: suppliers.id }).from(suppliers).limit(1);

  // Zones de livraison (valeurs de travail à remplacer par le barème du propriétaire)
  const zones = [
    { id: 'zone_pickup_daloa', name: 'Retrait en boutique — Daloa', city: 'Daloa', isLocal: true, isPickup: true, fee: 0, freeAbove: null, delay: 'Immédiat pendant les horaires d’ouverture', order: 0 },
    { id: 'zone_daloa_domicile', name: 'Daloa — livraison à domicile (DÉMO)', city: 'Daloa', isLocal: true, isPickup: false, fee: 1500, freeAbove: 50000, delay: 'Sous 24 h ouvrées', order: 1 },
    { id: 'zone_abidjan', name: 'Abidjan — expédition (DÉMO)', city: 'Abidjan', isLocal: false, isPickup: false, fee: 4000, freeAbove: null, delay: '2 à 4 jours par car', order: 2 },
    { id: 'zone_yamoussoukro', name: 'Yamoussoukro — expédition (DÉMO)', city: 'Yamoussoukro', isLocal: false, isPickup: false, fee: 3500, freeAbove: null, delay: '2 à 3 jours par car', order: 3 },
    { id: 'zone_bouake', name: 'Bouaké — expédition (DÉMO)', city: 'Bouaké', isLocal: false, isPickup: false, fee: 4000, freeAbove: null, delay: '2 à 4 jours par car', order: 4 },
    { id: 'zone_sanpedro', name: 'San-Pédro — expédition (DÉMO)', city: 'San-Pédro', isLocal: false, isPickup: false, fee: 5000, freeAbove: null, delay: '3 à 5 jours par transporteur', order: 5 },
    { id: 'zone_autre', name: 'Autre ville — Côte d’Ivoire (DÉMO)', city: 'Autre ville', isLocal: false, isPickup: false, fee: 5000, freeAbove: null, delay: '3 à 5 jours, transporteur à confirmer', order: 6 },
  ];
  for (const zone of zones) {
    await db
      .insert(deliveryZones)
      .values({
        id: zone.id,
        name: zone.name,
        city: zone.city,
        isLocal: zone.isLocal,
        isPickup: zone.isPickup,
        fee: String(zone.fee),
        freeAbove: zone.freeAbove === null ? null : String(zone.freeAbove),
        estimatedDelay: zone.delay,
        sortOrder: zone.order,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: deliveryZones.id,
        set: { name: zone.name, city: zone.city, isLocal: zone.isLocal, isPickup: zone.isPickup, fee: String(zone.fee), freeAbove: zone.freeAbove === null ? null : String(zone.freeAbove), estimatedDelay: zone.delay, sortOrder: zone.order },
      });
  }

  // Produits
  let created = 0;
  for (const [index, item] of PRODUCTS.entries()) {
    const sku = `MED-${String(index + 1).padStart(4, '0')}`;
    const slug = slugify(`${item.name}-${sku}`);
    const categoryId = categoryIds.get(item.category) ?? null;
    const brandId = item.brand ? brandIds.get(item.brand) ?? null : null;
    const categoryName = CATEGORIES.flatMap((c) => [c, ...(c.children ?? [])]).find((c) => c.slug === item.category)?.name ?? null;
    const brandName = item.brand ? BRANDS.find((b) => b.slug === item.brand)?.name ?? null : null;

    const searchText = buildSearchText({
      name: item.name,
      sku,
      shortDescription: item.short,
      keywords: item.keywords,
      brandName,
      categoryName,
      attributes: Object.entries(item.attributes).map(([name, value]) => ({ name, value })),
    });

    const productId = `prd_${sku.toLowerCase()}`;
    const now = new Date();
    const promoEnds = item.promo ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) : null;

    await db
      .insert(products)
      .values({
        id: productId,
        sku,
        slug,
        name: item.name,
        shortDescription: item.short,
        description: item.description,
        price: String(item.price),
        promoPrice: item.promo ? String(item.promo) : null,
        promoStartsAt: item.promo ? new Date(now.getTime() - 24 * 60 * 60 * 1000) : null,
        promoEndsAt: promoEnds,
        stock: item.stock,
        reserved: 0,
        lowStockThreshold: 5,
        isActive: true,
        isFeatured: Boolean(item.featured),
        soldCount: Math.max(0, 40 - index),
        searchText,
        keywords: item.keywords,
        categoryId,
        brandId,
        supplierId: supplierRows[0]?.id ?? null,
        warranty: item.category === 'electromenager' ? '12 mois' : null,
      })
      .onConflictDoUpdate({
        target: products.sku,
        set: {
          name: item.name,
          slug,
          shortDescription: item.short,
          description: item.description,
          price: String(item.price),
          promoPrice: item.promo ? String(item.promo) : null,
          stock: item.stock,
          searchText,
          keywords: item.keywords,
          categoryId,
          brandId,
          updatedAt: new Date(),
        },
      });

    // Images de démonstration
    const existingImages = await db.select({ id: productImages.id }).from(productImages).where(eq(productImages.productId, productId));
    if (existingImages.length === 0) {
      for (let imageIndex = 0; imageIndex < 2; imageIndex++) {
        const image = await ensurePlaceholderImage({ name: item.name, sku, index: imageIndex, tone: item.category });
        await db.insert(productImages).values({
          id: newId('img_'),
          productId,
          url: image.url,
          alt: `${item.name} — photo ${imageIndex + 1}`,
          position: imageIndex,
          width: image.width,
          height: image.height,
          checksum: image.checksum,
        });
      }
    }

    // Caractéristiques
    await db.delete(productAttributes).where(eq(productAttributes.productId, productId));
    const attributes = Object.entries(item.attributes);
    for (const [position, [name, value]] of attributes.entries()) {
      await db.insert(productAttributes).values({ id: newId('att_'), productId, name, value, position });
    }

    created += 1;
  }

  // Comptes de démonstration (uniquement si SEED_DEMO=1)
  if (process.env.SEED_DEMO === '1') {
    const demoPassword = process.env.SEED_DEMO_PASSWORD ?? 'DemoMedi2026!';
    const accounts = [
      { email: 'proprietaire@medi.demo', role: 'OWNER' as const, firstName: 'Propriétaire', lastName: 'MeDi (démo)' },
      { email: 'admin@medi.demo', role: 'ADMIN' as const, firstName: 'Admin', lastName: 'MeDi (démo)' },
      { email: 'stock@medi.demo', role: 'STOCK_MANAGER' as const, firstName: 'Gestion', lastName: 'Stock (démo)' },
      { email: 'commandes@medi.demo', role: 'ORDER_MANAGER' as const, firstName: 'Gestion', lastName: 'Commandes (démo)' },
      { email: 'client@medi.demo', role: 'CUSTOMER' as const, firstName: 'Client', lastName: 'Démonstration' },
    ];
    for (const account of accounts) {
      const existing = await db.select().from(users).where(eq(users.email, account.email)).limit(1);
      if (existing[0]) {
        if (!(await verifyPassword(demoPassword, existing[0].passwordHash))) {
          await db.update(users).set({ passwordHash: await hashPassword(demoPassword) }).where(eq(users.id, existing[0].id));
        }
        continue;
      }
      await db.insert(users).values({
        id: newId('usr_'),
        email: account.email,
        passwordHash: await hashPassword(demoPassword),
        firstName: account.firstName,
        lastName: account.lastName,
        role: account.role,
        isActive: true,
      });
    }
    console.log(`   Comptes de démonstration créés — mot de passe : ${demoPassword}`);
    console.log('   ⚠️  Comptes de DÉMONSTRATION uniquement : supprimez-les avant la mise en production.');
  }

  console.log(`   ${created} produits, ${CATEGORIES.length} catégories racines, ${zones.length} zones de livraison.`);
  console.log('   Les coordonnées de la boutique restent vides : à saisir dans /admin/parametres.');
  await pool.end();
}

main().catch(async (error) => {
  console.error('Échec du seed :', error);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
