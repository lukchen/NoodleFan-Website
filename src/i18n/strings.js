// UI strings for bilingual support (EN / ZH).
// All user-visible text lives here — never hardcode strings in components.

const strings = {
  en: {
    nav: {
      menu: 'Menu',
      order: 'Order Now',
    },
    hero: {
      tagline: 'Authentic Chinese Noodles & Rice Noodles',
      sub: 'Fresh, handcrafted, delivered to you.',
      cta: 'Order Now',
    },
    menu: {
      title: 'Our Menu',
      price: (p) => `$${p}`,
    },
    footer: {
      copy: '© 2025 NoodleFan 粉面王. All rights reserved.',
    },
  },
  zh: {
    nav: {
      menu: '菜单',
      order: '立即点餐',
    },
    hero: {
      tagline: '正宗中式粉面',
      sub: '新鲜手工，送餐到家。',
      cta: '立即点餐',
    },
    menu: {
      title: '我们的菜单',
      price: (p) => `$${p}`,
    },
    footer: {
      copy: '© 2025 NoodleFan 粉面王. 保留所有权利。',
    },
  },
}

export default strings
