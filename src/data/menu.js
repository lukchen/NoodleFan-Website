// Menu data — single source of truth for all menu items.
// To add/edit/remove a dish, modify this array only.
// Fields: id, price, image (URL or null), nameEn, nameZh, descEn, descZh
// NOTE: images are temporary placeholders — replace with own photos before launch

const menu = [
  {
    id: 1,
    price: 16,
    image: '/images/tianjin-beef-noodle.png',
    nameEn: 'Tianjin Yellow Broth Beef Noodle',
    nameZh: '天津黄汤牛肉拉面',
    descEn: 'Hand-pulled noodles in a rich golden bone broth seasoned with Tianjin-style spices. Topped with tender braised beef slices and fresh scallions.',
    descZh: '天津风味手工拉面，浓郁金黄骨汤，香料熬制，配以软烂卤牛肉片与葱花。',
  },
  {
    id: 2,
    price: 16,
    image: '/images/taiwanese-beef-noodle.jpg',
    nameEn: 'Taiwanese Beef Noodle',
    nameZh: '台式牛肉面',
    descEn: 'Slow-braised beef shank in a deep, spiced soy broth with chili bean paste. Served over springy wheat noodles with pickled mustard greens.',
    descZh: '红烧牛腱慢炖，汤底浓郁，加入豆瓣酱与香料。配劲道小麦面条，附酸菜提鲜。',
  },
  {
    id: 3,
    price: 15,
    image: '/images/jiangxi-fried-noodle.jpg',
    nameEn: 'Jiangxi Fried Rice Noodle',
    nameZh: '江西炒粉',
    descEn: 'Wok-tossed Jiangxi flat rice noodles with egg, pork, bean sprouts, and chives in a savory soy-based sauce. Smoky wok breath in every bite.',
    descZh: '江西宽米粉大火爆炒，配鸡蛋、猪肉、豆芽与韭黄，酱香浓郁，镬气十足。',
  },
  {
    id: 4,
    price: 13,
    image: '/images/jiangxi-sancian.jpg',
    nameEn: 'Jiangxi Three Delicacies Noodle',
    nameZh: '江西三鲜泡粉',
    descEn: 'Silky Jiangxi rice noodles in a clear pork bone broth, topped with soybeans, wood ear mushroom, and scallions — simple, hearty, and deeply satisfying.',
    descZh: '江西米粉泡在清澈猪骨汤中，铺满黄豆、木耳与葱花，朴实鲜香，回味绵长。',
  },
  {
    id: 5,
    price: 16,
    image: '/images/jiangxi-beef-noodle.jpg',
    nameEn: 'Jiangxi Spicy Beef Rice Noodle',
    nameZh: '江西牛肉泡粉',
    descEn: 'Jiangxi rice noodles soaked in a bold, spicy red broth loaded with braised beef chunks, soybeans, and fresh cilantro. Rich heat with every sip.',
    descZh: '江西米粉泡入浓辣红汤，满铺卤牛肉块、黄豆与香菜，汤底醇厚，辣而过瘾。',
  },
]

export default menu
