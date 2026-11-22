import imgDomino from '../assets/placeholders/restaurant-domino.svg';
import imgRuby from '../assets/placeholders/restaurant-ruby.svg';
import imgDosa from '../assets/placeholders/restaurant-dosa.svg';
import imgMistanna from '../assets/placeholders/restaurant-mistanna.svg';
import imgBurger from '../assets/placeholders/restaurant-burger.svg';
import imgBiryani from '../assets/placeholders/restaurant-biryani.svg';
import imgChina from '../assets/placeholders/restaurant-china.svg';
import imgRolls from '../assets/placeholders/restaurant-rolls.svg';

import catMomos from '../assets/placeholders/cat-momos.svg';
import catNoodles from '../assets/placeholders/cat-noodles.svg';
import catPizza from '../assets/placeholders/cat-pizza.svg';
import catBiryani from '../assets/placeholders/cat-biryani.svg';
import catRolls from '../assets/placeholders/cat-rolls.svg';
import catBurger from '../assets/placeholders/cat-burger.svg';
import catChinese from '../assets/placeholders/cat-chinese.svg';
import catSouthIndian from '../assets/placeholders/cat-south-indian.svg';
import catSweets from '../assets/placeholders/cat-sweets.svg';
import catBeverages from '../assets/placeholders/cat-beverages.svg';

import dishPizza from '../assets/placeholders/dish-pizza.svg';
import dishPaneer from '../assets/placeholders/dish-paneer.svg';
import dishBread from '../assets/placeholders/dish-bread.svg';
import dishCake from '../assets/placeholders/dish-cake.svg';
import dishRice from '../assets/placeholders/dish-rice.svg';
import dishCurry from '../assets/placeholders/dish-curry.svg';
import dishFish from '../assets/placeholders/dish-fish.svg';
import dishChicken from '../assets/placeholders/dish-chicken.svg';
import dishDosa from '../assets/placeholders/dish-dosa.svg';
import dishIdli from '../assets/placeholders/dish-idli.svg';
import dishSweets from '../assets/placeholders/dish-sweets.svg';
import dishBurger from '../assets/placeholders/dish-burger.svg';
import dishFries from '../assets/placeholders/dish-fries.svg';
import dishDrink from '../assets/placeholders/dish-drink.svg';
import dishNoodles from '../assets/placeholders/dish-noodles.svg';
import dishMomo from '../assets/placeholders/dish-momo.svg';
import dishRoll from '../assets/placeholders/dish-roll.svg';
import dishSoup from '../assets/placeholders/dish-soup.svg';

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  isVeg: boolean;
  bestseller?: boolean;
  desc: string;
  image: string;
}

export interface Restaurant {
  id: number;
  name: string;
  rating: string;
  time: string;
  distance: string;
  offer: string;
  cuisine: string;
  priceForTwo: number;
  image: string;
  menu: MenuItem[];
}

export interface Category {
  id: string;
  name: string;
  query: string;
  image: string;
}

export interface DemoUser {
  name: string;
  phone: string;
  email: string;
}

export type OrderStatus = 'confirmed' | 'preparing' | 'picked_up' | 'on_the_way' | 'delivered' | 'cancelled';

export interface OrderLine {
  name: string;
  qty: number;
  price: number;
}

export interface Order {
  id: string;
  restaurantId: number;
  restaurantName: string;
  lines: OrderLine[];
  subtotal: number;
  platformFee: number;
  discount: number;
  total: number;
  status: OrderStatus;
  placedAt: string;
  eta: string;
  paymentMethod: string;
  address: string;
}

export interface Coupon {
  code: string;
  title: string;
  subtitle: string;
  type: 'percent' | 'flat';
  value: number;
  maxDiscount?: number;
  minOrder: number;
}

export const DEMO_LOCATION = 'Home – Demo Street, Demo City';
export const DEMO_ADDRESS = 'Home · 42 Demo Street, Demo City, 735101';
export const PLATFORM_FEE = 5;
export const FREE_DELIVERY_ABOVE = 149;
export const DEMO_RIDER = {
  name: 'Rahul Das',
  vehicle: 'WB 64 AB 1234',
  rating: '4.8',
  phone: '+91 90000 12345',
};

const item = (
  id: string,
  name: string,
  price: number,
  isVeg: boolean,
  desc: string,
  image: string,
  bestseller = false,
): MenuItem => ({ id, name, price, isVeg, desc, image, bestseller });

export const restaurants: Restaurant[] = [
  {
    id: 1,
    name: "Domino's Pizza",
    rating: '4.3',
    time: '25-30 mins',
    distance: '3.1 km',
    offer: 'FLAT 50% OFF',
    cuisine: 'Pizza, Fast Food',
    priceForTwo: 450,
    image: imgDomino,
    menu: [
      item('d1', 'Margherita Pizza', 199, true, 'Classic tomato base with mozzarella and fresh basil', dishPizza, true),
      item('d2', 'Peppy Paneer Pizza', 349, true, 'Spicy paneer chunks with crunchy capsicum', dishPaneer),
      item('d3', 'Farmhouse Pizza', 399, true, 'Garden fresh mushrooms, capsicum and tomatoes', dishPizza),
      item('d4', 'Chicken Dominator', 459, false, 'Double chicken with smoky barbeque base', dishChicken, true),
      item('d5', 'Garlic Breadsticks', 99, true, 'Golden breadsticks brushed with garlic butter', dishBread),
      item('d6', 'Stuffed Garlic Bread', 149, true, 'Oven-baked bread stuffed with cheesy filling', dishBread),
      item('d7', 'Choco Lava Cake', 109, true, 'Warm chocolate cake with molten center', dishCake),
    ],
  },
  {
    id: 2,
    name: "Ruby's Swader Prantik",
    rating: '4.0',
    time: '30-35 mins',
    distance: '3.9 km',
    offer: 'Flat ₹50 OFF above ₹99',
    cuisine: 'Bengali, North Indian',
    priceForTwo: 500,
    image: imgRuby,
    menu: [
      item('r1', 'Basanti Pulao', 120, true, 'Aromatic yellow rice cooked with cashews and raisins', dishRice),
      item('r2', 'Kosha Mangsho', 280, false, 'Slow-cooked mutton in rich Bengali spices', dishCurry, true),
      item('r3', 'Fish Fry (2 pcs)', 160, false, 'Crispy batter-fried fish with mustard dip', dishFish),
      item('r4', 'Dhokar Dalna', 90, true, 'Lentil cakes in tomato-ginger gravy', dishCurry),
      item('r5', 'Chicken Dak Bungalow', 220, false, 'Country-style chicken curry with egg', dishChicken),
      item('r6', 'Luchi (4 pcs)', 40, true, 'Soft deep-fried Bengal flatbread', dishBread),
      item('r7', 'Misti Doi', 50, true, 'Sweetened Bengali yogurt, chilled and creamy', dishSweets),
    ],
  },
  {
    id: 3,
    name: 'Mumbai Dosa Plaza',
    rating: '4.2',
    time: '20-25 mins',
    distance: '2.3 km',
    offer: 'Flat ₹75 OFF above ₹149',
    cuisine: 'South Indian',
    priceForTwo: 250,
    image: imgDosa,
    menu: [
      item('m1', 'Masala Dosa', 80, true, 'Crispy rice crepe with spiced potato filling', dishDosa, true),
      item('m2', 'Paneer Butter Dosa', 120, true, 'Buttery dosa loaded with paneer masala', dishDosa),
      item('m3', 'Idli Sambar (2 pcs)', 50, true, 'Steamed rice cakes with lentil vegetable broth', dishIdli),
      item('m4', 'Medu Vada', 60, true, 'Crispy lentil doughnuts served with chutney', dishIdli),
      item('m5', 'Onion Uttapam', 90, true, 'Thick rice pancake topped with onions and tomatoes', dishDosa),
      item('m6', 'Paper Plain Dosa', 60, true, 'Super thin and crispy plain dosa', dishDosa),
      item('m7', 'Upma', 45, true, 'Savory semolina porridge with vegetables', dishIdli),
    ],
  },
  {
    id: 4,
    name: 'Shri Radhakrishna Mistanna',
    rating: '4.5',
    time: '15-20 mins',
    distance: '1.2 km',
    offer: '20% OFF on Sweets',
    cuisine: 'Sweets, Snacks',
    priceForTwo: 200,
    image: imgMistanna,
    menu: [
      item('s1', 'Rasgulla (2 pcs)', 30, true, 'Soft spongy cottage cheese balls in sugar syrup', dishSweets, true),
      item('s2', 'Gulab Jamun', 30, true, 'Deep fried milk solids soaked in rose syrup', dishSweets),
      item('s3', 'Kaju Katli (250g)', 250, true, 'Diamond-shaped cashew fudge with silver leaf', dishSweets),
      item('s4', 'Samosa (2 pcs)', 20, true, 'Crispy pastry filled with spiced potatoes', dishFries),
      item('s5', 'Paneer Pakora', 80, true, 'Cottage cheese fritters in gram flour batter', dishPaneer),
      item('s6', 'Jalebi (100g)', 40, true, 'Crispy spiral-shaped sweet soaked in saffron syrup', dishSweets),
      item('s7', 'Lassi', 50, true, 'Thick chilled yogurt drink, sweet or salted', dishDrink),
    ],
  },
  {
    id: 5,
    name: 'Burger King',
    rating: '4.1',
    time: '25-30 mins',
    distance: '4.5 km',
    offer: 'Buy 1 Get 1 Free',
    cuisine: 'Burgers, Fast Food',
    priceForTwo: 350,
    image: imgBurger,
    menu: [
      item('b1', 'Crispy Veg Burger', 79, true, 'Crunchy veggie patty with fresh lettuce and sauce', dishBurger, true),
      item('b2', 'Whopper Junior', 149, false, 'Flame-grilled beef patty with fresh vegetables', dishBurger),
      item('b3', 'Chicken Wings (4 pcs)', 199, false, 'Crispy fried chicken wings with dipping sauce', dishChicken),
      item('b4', 'Veggie Strips', 99, true, 'Crispy vegetable strips with tangy dip', dishFries),
      item('b5', 'French Fries (M)', 95, true, 'Golden crispy fries lightly salted', dishFries),
      item('b6', 'Fiery Chicken Burger', 179, false, 'Spicy fried chicken with jalapenos and sriracha', dishBurger),
      item('b7', 'Pepsi (500ml)', 60, true, 'Chilled carbonated soft drink', dishDrink),
    ],
  },
  {
    id: 6,
    name: 'The Biryani Life',
    rating: '4.4',
    time: '35-40 mins',
    distance: '5.2 km',
    offer: 'Free Dessert on ₹400',
    cuisine: 'Biryani, Mughlai',
    priceForTwo: 550,
    image: imgBiryani,
    menu: [
      item('y1', 'Hyderabadi Chicken Biryani', 250, false, 'Slow-cooked dum biryani with saffron and whole spices', dishRice, true),
      item('y2', 'Lucknowi Mutton Biryani', 350, false, 'Tender mutton pieces with fragrant basmati rice', dishRice),
      item('y3', 'Paneer Tikka Biryani', 210, true, 'Smoky grilled paneer layered with aromatic rice', dishRice),
      item('y4', 'Egg Biryani', 180, false, 'Spiced basmati rice with boiled eggs', dishRice),
      item('y5', 'Chicken Tikka (6 pcs)', 240, false, 'Tandoor-marinated chicken tikka pieces', dishChicken),
      item('y6', 'Raita', 30, true, 'Chilled yogurt with cucumber and cumin', dishCurry),
      item('y7', 'Double Ka Meetha', 80, true, 'Hyderabadi bread pudding with dry fruits', dishCake),
    ],
  },
  {
    id: 7,
    name: 'China Town',
    rating: '3.9',
    time: '20-25 mins',
    distance: '2.8 km',
    offer: 'Extra 10% OFF',
    cuisine: 'Chinese, Asian',
    priceForTwo: 400,
    image: imgChina,
    menu: [
      item('c1', 'Veg Chowmein', 100, true, 'Stir-fried noodles with fresh vegetables', dishNoodles, true),
      item('c2', 'Chicken Fried Rice', 150, false, 'Wok-tossed rice with egg and chicken', dishRice),
      item('c3', 'Paneer Manchurian', 140, true, 'Crispy paneer in tangy Indo-Chinese sauce', dishPaneer),
      item('c4', 'Chilli Chicken', 180, false, 'Dry-tossed chicken with green chillies and peppers', dishChicken),
      item('c5', 'Spring Rolls (4 pcs)', 80, true, 'Crispy rolls filled with mixed vegetables', dishRoll),
      item('c6', 'Momos (6 pcs)', 60, true, 'Steamed Tibetan dumplings with spicy dip', dishMomo),
      item('c7', 'Hot & Sour Soup', 70, true, 'Tangy and spicy vegetable broth', dishSoup),
    ],
  },
  {
    id: 8,
    name: 'Rolls Mania',
    rating: '4.0',
    time: '15-20 mins',
    distance: '1.5 km',
    offer: 'Combos starting at ₹129',
    cuisine: 'Rolls, Wraps',
    priceForTwo: 250,
    image: imgRolls,
    menu: [
      item('o1', 'Double Egg Roll', 60, false, 'Paratha roll with double egg and onions', dishRoll, true),
      item('o2', 'Chicken Cheese Roll', 110, false, 'Grilled chicken with melted cheese in a wrap', dishRoll),
      item('o3', 'Paneer Tikka Roll', 90, true, 'Spiced paneer tikka with mint chutney', dishRoll),
      item('o4', 'Mix Veg Roll', 70, true, 'Fresh veggies with hummus in a soft wrap', dishRoll),
      item('o5', 'Mutton Keema Roll', 140, false, 'Spicy minced mutton with onion and chilli', dishRoll),
      item('o6', 'Potato Corn Roll', 80, true, 'Crunchy corn and potato mix in a crispy paratha', dishRoll),
      item('o7', 'Cold Coffee', 70, true, 'Chilled blended coffee with milk and ice cream', dishDrink),
    ],
  },
];

export const categories: Category[] = [
  { id: 'momos', name: 'Momos', query: 'Momo', image: catMomos },
  { id: 'noodles', name: 'Noodles', query: 'Noodles', image: catNoodles },
  { id: 'pizza', name: 'Pizzas', query: 'Pizza', image: catPizza },
  { id: 'biryani', name: 'Biryani', query: 'Biryani', image: catBiryani },
  { id: 'rolls', name: 'Rolls', query: 'Roll', image: catRolls },
  { id: 'burgers', name: 'Burgers', query: 'Burger', image: catBurger },
  { id: 'chinese', name: 'Chinese', query: 'Chinese', image: catChinese },
  { id: 'south-indian', name: 'South Indian', query: 'South Indian', image: catSouthIndian },
  { id: 'sweets', name: 'Sweets', query: 'Sweets', image: catSweets },
  { id: 'beverages', name: 'Beverages', query: 'Coffee', image: catBeverages },
];

export const demoUser: DemoUser = {
  name: 'Demo Foodie',
  phone: '+91 98765 43210',
  email: 'demo@navereat.app',
};

export const demoOrders: Order[] = [
  {
    id: 'NAV-240318',
    restaurantId: 6,
    restaurantName: 'The Biryani Life',
    lines: [
      { name: 'Hyderabadi Chicken Biryani', qty: 1, price: 250 },
      { name: 'Raita', qty: 2, price: 30 },
      { name: 'Double Ka Meetha', qty: 1, price: 80 },
    ],
    subtotal: 390,
    platformFee: 5,
    discount: 0,
    total: 395,
    status: 'on_the_way',
    placedAt: '2026-11-22T12:24:00+05:30',
    eta: '12 mins',
    paymentMethod: 'UPI · demo@upi',
    address: DEMO_ADDRESS,
  },
  {
    id: 'NAV-240287',
    restaurantId: 1,
    restaurantName: "Domino's Pizza",
    lines: [
      { name: 'Margherita Pizza', qty: 1, price: 199 },
      { name: 'Garlic Breadsticks', qty: 1, price: 99 },
      { name: 'Choco Lava Cake', qty: 1, price: 109 },
    ],
    subtotal: 407,
    platformFee: 5,
    discount: 50,
    total: 362,
    status: 'delivered',
    placedAt: '2026-11-20T20:12:00+05:30',
    eta: 'Delivered',
    paymentMethod: 'Cash on Delivery',
    address: DEMO_ADDRESS,
  },
  {
    id: 'NAV-240251',
    restaurantId: 5,
    restaurantName: 'Burger King',
    lines: [
      { name: 'Crispy Veg Burger', qty: 2, price: 79 },
      { name: 'French Fries (M)', qty: 1, price: 95 },
      { name: 'Pepsi (500ml)', qty: 1, price: 60 },
    ],
    subtotal: 313,
    platformFee: 5,
    discount: 0,
    total: 318,
    status: 'delivered',
    placedAt: '2026-11-17T13:41:00+05:30',
    eta: 'Delivered',
    paymentMethod: 'UPI · demo@upi',
    address: DEMO_ADDRESS,
  },
];

export const coupons: Coupon[] = [
  { code: 'WELCOME50', title: '50% OFF', subtitle: 'Up to ₹100 off your first order', type: 'percent', value: 50, maxDiscount: 100, minOrder: 199 },
  { code: 'FLAT75', title: '₹75 OFF', subtitle: 'On orders above ₹299', type: 'flat', value: 75, minOrder: 299 },
  { code: 'TASTY40', title: '₹40 OFF', subtitle: 'On orders above ₹149', type: 'flat', value: 40, minOrder: 149 },
];

export const paymentMethods = ['Cash on Delivery', 'UPI · demo@upi', 'Card · **** 4242'];

export const findRestaurant = (id: number | string | undefined): Restaurant | undefined =>
  restaurants.find((r) => r.id === Number(id));

export const findOrder = (id: string | undefined): Order | undefined =>
  demoOrders.find((o) => o.id === id);
