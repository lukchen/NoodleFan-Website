// Menu data — single source of truth for all menu items.
// To add/edit/remove a dish, modify this array only.
// Fields: id, price, image (URL or null), nameEn, nameZh, descEn, descZh
// NOTE: images are web placeholders only — replace with own photos before launch

const menu = [
  {
    id: 1,
    price: 16,
    image: 'https://redhousespice.com/wp-content/uploads/2025/10/taiwanese-beef-noodle-soup.jpg',
    nameEn: 'Tianjin Yellow Broth Beef Noodle',
    nameZh: '天津黄汤牛肉拉面',
    descEn: 'Hand-pulled noodles in a rich golden bone broth seasoned with Tianjin-style spices. Topped with tender braised beef slices and fresh scallions.',
    descZh: '天津风味手工拉面，浓郁金黄骨汤，香料熬制，配以软烂卤牛肉片与葱花。',
  },
  {
    id: 2,
    price: 16,
    image: 'https://iheartumami.com/wp-content/uploads/2015/07/Asain-beef-noodle-soup-1-scaled.jpg',
    nameEn: 'Taiwanese Beef Noodle',
    nameZh: '台式牛肉面',
    descEn: 'Slow-braised beef shank in a deep, spiced soy broth with chili bean paste. Served over springy wheat noodles with pickled mustard greens.',
    descZh: '红烧牛腱慢炖，汤底浓郁，加入豆瓣酱与香料。配劲道小麦面条，附酸菜提鲜。',
  },
  {
    id: 3,
    price: 15,
    image: 'https://redhousespice.com/wp-content/uploads/2017/02/Egg-fried-rice-noodles-portrait2.jpg',
    nameEn: 'Jiangxi Fried Rice Noodle',
    nameZh: '江西炒粉',
    descEn: 'Wok-tossed Jiangxi flat rice noodles with egg, pork, bean sprouts, and chives in a savory soy-based sauce. Smoky wok breath in every bite.',
    descZh: '江西宽米粉大火爆炒，配鸡蛋、猪肉、豆芽与韭黄，酱香浓郁，镬气十足。',
  },
  {
    id: 4,
    price: 13,
    image: 'https://thewoksoflife.com/wp-content/uploads/2020/04/yunnan-rice-noodle-soup-15-e1609273169163.jpg',
    nameEn: 'Jiangxi Three Delicacies Noodle',
    nameZh: '江西三鲜泡粉',
    descEn: 'Silky Jiangxi rice noodles in a clear pork bone broth, topped with shrimp, pork slices, and shiitake mushroom — the classic "three delicacies" combination.',
    descZh: '江西米粉泡在清澈猪骨汤中，三鲜配料：虾仁、猪肉片、香菇，鲜味层次丰富。',
  },
  {
    id: 5,
    price: 16,
    image: 'https://khinskitchen.com/wp-content/uploads/2021/06/beef-noodles-soup.jpg',
    nameEn: 'Jiangxi Beef Rice Noodle',
    nameZh: '江西牛肉泡粉',
    descEn: 'Smooth Jiangxi rice noodles soaked in a hearty beef bone broth, piled with thinly sliced marinated beef, crispy fried shallots, and fresh cilantro.',
    descZh: '江西滑米粉浸于浓香牛骨汤，铺上腌制牛肉薄片，撒香脆葱酥与香菜，鲜香醇厚。',
  },
]

export default menu
