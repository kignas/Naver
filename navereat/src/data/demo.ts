import imgDomino from '../assets/placeholders/restaurant-domino.svg';
import imgDosa from '../assets/placeholders/restaurant-dosa.svg';
import imgMistanna from '../assets/placeholders/restaurant-mistanna.svg';
import imgBurger from '../assets/placeholders/restaurant-burger.svg';
import imgBiryani from '../assets/placeholders/restaurant-biryani.svg';
import imgChina from '../assets/placeholders/restaurant-china.svg';
import imgRolls from '../assets/placeholders/restaurant-rolls.svg';

import mindPizza from '../assets/placeholders/mind-pizza.svg';
import mindChowmein from '../assets/placeholders/mind-chowmein.svg';
import mindFriedRice from '../assets/placeholders/mind-fried-rice.svg';
import mindPuchka from '../assets/placeholders/mind-puchka.svg';
import mindBiryani from '../assets/placeholders/mind-biryani.svg';
import mindRolls from '../assets/placeholders/mind-rolls.svg';
import mindSweets from '../assets/placeholders/mind-sweets.svg';
import mindIceCream from '../assets/placeholders/mind-icecream.svg';
import mindMomos from '../assets/placeholders/cat-momos.svg';
import mindDosa from '../assets/placeholders/cat-south-indian.svg';

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
  originalPrice?: number;
  discountPercent?: number;
  category?: string;
}

export interface Restaurant {
  id: number;
  name: string;
  rating: string;
  ratingCount?: number;
  time: string;
  distance: string;
  distanceKm?: number;
  deliveryMin?: number;
  deliveryMax?: number;
  offer: string;
  cuisine: string;
  priceForTwo: number;
  image: string;
  minimumOrder?: number;
  freeDeliveryRemaining?: number;
  freeDeliveryAbove?: number;
  verified?: boolean;
  pureVeg?: boolean;
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

export interface DemoOffer {
  id: string;
  kind: 'delivery' | 'discount';
  threshold: number;
  amount: number;
  big: string;
  sub: string;
  row: string;
  chip?: string;
}

export const DEMO_LOCATION = 'Home – Demo Street, Demo City';
export const DEMO_ADDRESS_LINE = 'Demo Street, Demo City…';
export const DEMO_ADDRESS = 'Home · 42 Demo Street, Demo City, 735101';
export const PLATFORM_FEE = 0;
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
  originalPrice?: number,
  discountPercent?: number,
): MenuItem => ({
  id,
  name,
  price,
  isVeg,
  desc,
  image,
  bestseller,
  ...(originalPrice != null ? { originalPrice } : {}),
  ...(discountPercent != null ? { discountPercent } : {}),
});

const inCategory = (category: string, menuItem: MenuItem): MenuItem => ({ ...menuItem, category });

export const restaurants: Restaurant[] = [
  {
    id: 1,
    name: 'Foodie Dosa Restaurant',
    rating: '4.2',
    ratingCount: 1240,
    time: '30-40 min',
    distance: '4.2 km',
    distanceKm: 4.2,
    deliveryMin: 30,
    deliveryMax: 40,
    offer: 'UP TO 30% OFF',
    cuisine: 'South Indian • Chinese',
    priceForTwo: 300,
    image: imgDosa,
    minimumOrder: 149,
    freeDeliveryRemaining: 399,
    freeDeliveryAbove: 399,
    verified: true,
    pureVeg: false,
    menu: [
      inCategory('Dosas', item('fd1', 'Masala Dosa', 99, true, 'Crispy rice crepe with spiced potato filling', dishDosa, true, 141, 30)),
      inCategory('Dosas', item('fd2', 'Paneer Dosa', 149, true, 'Buttery dosa loaded with paneer masala', dishPaneer)),
      inCategory('Dosas', item('fd3', 'Chicken Dosa', 179, false, 'Crispy dosa topped with spicy chicken keema', dishChicken)),
      inCategory('Sides', item('fd4', 'Idli Sambar (2 pcs)', 69, true, 'Steamed rice cakes with lentil vegetable broth', dishIdli)),
      inCategory('Sides', item('fd5', 'Medu Vada', 79, true, 'Crispy lentil doughnuts served with chutney', dishIdli)),
      inCategory('Dosas', item('fd6', 'Onion Uttapam', 119, true, 'Thick rice pancake topped with onions and tomatoes', dishDosa)),
      inCategory('Dosas', item('fd7', 'Rava Dosa', 129, true, 'Lacy semolina dosa with a crisp golden finish', dishDosa)),
      inCategory('Dosas', item('fd8', 'Ghee Podi Dosa', 139, true, 'Dosa brushed with ghee and house podi', dishDosa)),
      inCategory('Beverages', item('fd9', 'Filter Coffee', 49, true, 'Strong South Indian filter coffee with milk', dishDrink)),
    ],
  },
  {
    id: 2,
    name: 'Biryani Bhavan',
    rating: '4.4',
    ratingCount: 2100,
    time: '35-45 min',
    distance: '5.2 km',
    distanceKm: 5.2,
    deliveryMin: 35,
    deliveryMax: 45,
    offer: '',
    cuisine: 'Biryani • Mughlai',
    priceForTwo: 500,
    image: imgBiryani,
    minimumOrder: 149,
    freeDeliveryRemaining: 399,
    verified: true,
    pureVeg: false,
    menu: [
      item('bb1', 'Hyderabadi Chicken Biryani', 249, false, 'Slow-cooked dum biryani with saffron and whole spices', dishRice, true, 311, 20),
      item('bb2', 'Lucknowi Mutton Biryani', 349, false, 'Tender mutton pieces with fragrant basmati rice', dishRice),
      item('bb3', 'Paneer Tikka Biryani', 219, true, 'Smoky grilled paneer layered with aromatic rice', dishRice),
      item('bb4', 'Egg Biryani', 179, false, 'Spiced basmati rice with boiled eggs', dishRice),
      item('bb5', 'Chicken Tikka (6 pcs)', 239, false, 'Tandoor-marinated chicken tikka pieces', dishChicken),
      item('bb6', 'Mutton Curry', 269, false, 'Rich Mughlai mutton curry with warm spices', dishCurry),
      item('bb7', 'Raita', 39, true, 'Chilled yogurt with cucumber and cumin', dishCurry),
      item('bb8', 'Double Ka Meetha', 79, true, 'Hyderabadi bread pudding with dry fruits', dishCake),
    ],
  },
  {
    id: 3,
    name: 'Pizza Palace',
    rating: '4.3',
    ratingCount: 980,
    time: '25-35 min',
    distance: '3.1 km',
    distanceKm: 3.1,
    deliveryMin: 25,
    deliveryMax: 35,
    offer: 'FLAT ₹100 OFF',
    cuisine: 'Pizza • Italian',
    priceForTwo: 450,
    image: imgDomino,
    minimumOrder: 149,
    freeDeliveryRemaining: 399,
    verified: true,
    pureVeg: false,
    menu: [
      item('pp1', 'Margherita Pizza', 199, true, 'Classic tomato base with mozzarella and fresh basil', dishPizza, true),
      item('pp2', 'Peppy Paneer Pizza', 299, true, 'Spicy paneer chunks with crunchy capsicum', dishPaneer),
      item('pp3', 'Farmhouse Pizza', 349, true, 'Garden fresh mushrooms, capsicum and tomatoes', dishPizza),
      item('pp4', 'Chicken Dominator', 399, false, 'Double chicken with smoky barbeque base', dishChicken),
      item('pp5', 'Garlic Breadsticks', 99, true, 'Golden breadsticks brushed with garlic butter', dishBread),
      item('pp6', 'Stuffed Garlic Bread', 149, true, 'Oven-baked bread stuffed with cheesy filling', dishBread),
      item('pp7', 'Choco Lava Cake', 109, true, 'Warm chocolate cake with molten center', dishCake),
      item('pp8', 'Pepsi (500ml)', 60, true, 'Chilled carbonated soft drink', dishDrink),
    ],
  },
  {
    id: 4,
    name: 'Rolls Mania',
    rating: '4.0',
    ratingCount: 640,
    time: '20-30 min',
    distance: '1.8 km',
    distanceKm: 1.8,
    deliveryMin: 20,
    deliveryMax: 30,
    offer: '',
    cuisine: 'Rolls • Wraps',
    priceForTwo: 250,
    image: imgRolls,
    minimumOrder: 99,
    freeDeliveryRemaining: 299,
    verified: true,
    pureVeg: false,
    menu: [
      item('rm1', 'Double Egg Roll', 60, false, 'Paratha roll with double egg and onions', dishRoll, true, 71, 15),
      item('rm2', 'Chicken Cheese Roll', 110, false, 'Grilled chicken with melted cheese in a wrap', dishRoll),
      item('rm3', 'Paneer Tikka Roll', 90, true, 'Spiced paneer tikka with mint chutney', dishRoll),
      item('rm4', 'Mix Veg Roll', 70, true, 'Fresh veggies with hummus in a soft wrap', dishRoll),
      item('rm5', 'Mutton Keema Roll', 140, false, 'Spicy minced mutton with onion and chilli', dishRoll),
      item('rm6', 'Potato Corn Roll', 80, true, 'Crunchy corn and potato mix in a crispy paratha', dishRoll),
      item('rm7', 'Cold Coffee', 70, true, 'Chilled blended coffee with milk and ice cream', dishDrink),
    ],
  },
  {
    id: 5,
    name: 'China Town',
    rating: '3.9',
    ratingCount: 520,
    time: '25-35 min',
    distance: '2.8 km',
    distanceKm: 2.8,
    deliveryMin: 25,
    deliveryMax: 35,
    offer: '',
    cuisine: 'Chinese • Asian',
    priceForTwo: 400,
    image: imgChina,
    minimumOrder: 149,
    freeDeliveryRemaining: 399,
    verified: true,
    pureVeg: false,
    menu: [
      item('ct1', 'Veg Chowmein', 100, true, 'Stir-fried noodles with fresh vegetables', dishNoodles, true, 133, 25),
      item('ct2', 'Chicken Fried Rice', 150, false, 'Wok-tossed rice with egg and chicken', dishRice),
      item('ct3', 'Paneer Manchurian', 140, true, 'Crispy paneer in tangy Indo-Chinese sauce', dishPaneer),
      item('ct4', 'Chilli Chicken', 180, false, 'Dry-tossed chicken with green chillies and peppers', dishChicken),
      item('ct5', 'Chilli Fish', 190, false, 'Crispy fish tossed in a spicy chilli glaze', dishFish),
      item('ct6', 'Spring Rolls (4 pcs)', 80, true, 'Crispy rolls filled with mixed vegetables', dishRoll),
      item('ct7', 'Momos (6 pcs)', 60, true, 'Steamed Tibetan dumplings with spicy dip', dishMomo),
      item('ct8', 'Hot & Sour Soup', 70, true, 'Tangy and spicy vegetable broth', dishSoup),
    ],
  },
  {
    id: 6,
    name: 'Burger Hub',
    rating: '4.1',
    ratingCount: 760,
    time: '30-40 min',
    distance: '4.5 km',
    distanceKm: 4.5,
    deliveryMin: 30,
    deliveryMax: 40,
    offer: 'BUY 1 GET 1 DEAL',
    cuisine: 'Burgers • Fast Food',
    priceForTwo: 350,
    image: imgBurger,
    minimumOrder: 149,
    freeDeliveryRemaining: 399,
    verified: true,
    pureVeg: false,
    menu: [
      item('bh1', 'Crispy Veg Burger', 79, true, 'Crunchy veggie patty with fresh lettuce and sauce', dishBurger, true),
      item('bh2', 'Whopper Junior', 149, false, 'Flame-grilled chicken patty with fresh vegetables', dishBurger),
      item('bh3', 'Chicken Wings (4 pcs)', 199, false, 'Crispy fried chicken wings with dipping sauce', dishChicken),
      item('bh4', 'Veggie Strips', 99, true, 'Crispy vegetable strips with tangy dip', dishFries),
      item('bh5', 'French Fries (M)', 95, true, 'Golden crispy fries lightly salted', dishFries),
      item('bh6', 'Fiery Chicken Burger', 179, false, 'Spicy fried chicken with jalapenos and sriracha', dishBurger),
      item('bh7', 'Pepsi (500ml)', 60, true, 'Chilled carbonated soft drink', dishDrink),
    ],
  },
  {
    id: 7,
    name: 'Momo Hut',
    rating: '4.2',
    ratingCount: 410,
    time: '20-30 min',
    distance: '2.1 km',
    distanceKm: 2.1,
    deliveryMin: 20,
    deliveryMax: 30,
    offer: '',
    cuisine: 'Momos • Tibetan',
    priceForTwo: 200,
    image: imgChina,
    minimumOrder: 99,
    freeDeliveryRemaining: 299,
    verified: true,
    pureVeg: false,
    menu: [
      item('mh1', 'Steamed Veg Momos', 60, true, 'Soft steamed dumplings with cabbage and carrot', dishMomo, true, 67, 10),
      item('mh2', 'Chicken Momos', 80, false, 'Juicy chicken dumplings with spicy red chutney', dishMomo),
      item('mh3', 'Fried Momos', 90, true, 'Crispy fried vegetable momos with schezwan dip', dishMomo),
      item('mh4', 'Paneer Momos', 90, true, 'Steamed momos with a soft paneer filling', dishMomo),
      item('mh5', 'Chilli Momos', 110, false, 'Chicken momos tossed in a fiery chilli sauce', dishMomo),
      item('mh6', 'Momo Soup', 70, true, 'Clear vegetable broth with soft momos', dishSoup),
    ],
  },
  {
    id: 8,
    name: 'Mistanna Sweets',
    rating: '4.5',
    ratingCount: 1500,
    time: '15-25 min',
    distance: '1.2 km',
    distanceKm: 1.2,
    deliveryMin: 15,
    deliveryMax: 25,
    offer: '',
    cuisine: 'Sweets • Snacks',
    priceForTwo: 200,
    image: imgMistanna,
    minimumOrder: 99,
    freeDeliveryRemaining: 299,
    verified: true,
    pureVeg: true,
    menu: [
      item('ms1', 'Rasgulla (2 pcs)', 30, true, 'Soft spongy cottage cheese balls in sugar syrup', dishSweets, true, 38, 20),
      item('ms2', 'Gulab Jamun', 30, true, 'Deep fried milk solids soaked in rose syrup', dishSweets),
      item('ms3', 'Kaju Katli (250g)', 250, true, 'Diamond-shaped cashew fudge with silver leaf', dishSweets),
      item('ms4', 'Samosa (2 pcs)', 20, true, 'Crispy pastry filled with spiced potatoes', dishFries),
      item('ms5', 'Paneer Pakora', 80, true, 'Cottage cheese fritters in gram flour batter', dishPaneer),
      item('ms6', 'Jalebi (100g)', 40, true, 'Crispy spiral-shaped sweet soaked in saffron syrup', dishSweets),
      item('ms7', 'Lassi', 50, true, 'Thick chilled yogurt drink, sweet or salted', dishDrink),
      item('ms8', 'Sandesh', 60, true, 'Delicate Bengali sweet made with fresh chhena', dishSweets),
    ],
  },
];

export const categories: Category[] = [
  { id: 'pizza', name: 'Pizza', query: 'Pizza', image: mindPizza },
  { id: 'chowmein', name: 'Chowmein', query: 'Chowmein', image: mindChowmein },
  { id: 'fried-rice', name: 'Fried rice', query: 'Fried rice', image: mindFriedRice },
  { id: 'puchka', name: 'Puchka', query: 'Puchka', image: mindPuchka },
  { id: 'biryani', name: 'Biryani', query: 'Biryani', image: mindBiryani },
  { id: 'rolls', name: 'Rolls', query: 'Roll', image: mindRolls },
  { id: 'sweets', name: 'Sweets', query: 'Sweets', image: mindSweets },
  { id: 'ice-cream', name: 'Ice cream', query: 'Ice cream', image: mindIceCream },
  { id: 'momos', name: 'Momos', query: 'Momo', image: mindMomos },
  { id: 'south-indian', name: 'Dosa', query: 'Dosa', image: mindDosa },
];

export const demoUser: DemoUser = {
  name: 'Sagnik',
  phone: '+91 98765 43210',
  email: 'demo@navereat.app',
};

export const demoOrders: Order[] = [
  {
    id: 'NAV-240318',
    restaurantId: 2,
    restaurantName: 'Biryani Bhavan',
    lines: [
      { name: 'Hyderabadi Chicken Biryani', qty: 1, price: 249 },
      { name: 'Raita', qty: 1, price: 39 },
      { name: 'Double Ka Meetha', qty: 1, price: 79 },
    ],
    subtotal: 367,
    platformFee: 5,
    discount: 0,
    total: 372,
    status: 'on_the_way',
    placedAt: '2026-11-22T12:24:00+05:30',
    eta: '12 mins',
    paymentMethod: 'UPI · demo@upi',
    address: DEMO_ADDRESS,
  },
  {
    id: 'NAV-240287',
    restaurantId: 3,
    restaurantName: 'Pizza Palace',
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
    restaurantId: 6,
    restaurantName: 'Burger Hub',
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

export const demoOffers: DemoOffer[] = [
  {
    id: 'free-delivery-399',
    kind: 'delivery',
    threshold: 399,
    amount: 0,
    big: 'Hurray! Free delivery unlocked!',
    sub: 'Applied directly on bill, above ₹399',
    row: 'Free delivery applied',
    chip: 'You saved ₹30 on delivery',
  },
  {
    id: 'flat-100-499',
    kind: 'discount',
    threshold: 499,
    amount: 100,
    big: 'Instant ₹100 off!',
    sub: 'Extra discount applied to your bill',
    row: '₹100 extra off',
    chip: 'You saved ₹100',
  },
];

export const demoOffersFor = (subtotal: number): DemoOffer[] =>
  demoOffers.filter((offer) => subtotal >= offer.threshold);

export const paymentMethods = ['Cash on Delivery', 'UPI · demo@upi', 'Card · **** 4242'];

export const findRestaurant = (id: number | string | undefined): Restaurant | undefined =>
  restaurants.find((r) => r.id === Number(id));

export const findOrder = (id: string | undefined): Order | undefined =>
  demoOrders.find((o) => o.id === id);
