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
      sub: 'Fresh, handcrafted. Order ahead for pickup.',
      cta: 'Order Now',
    },
    menu: {
      title: 'Our Menu',
      price: (p) => `$${p}`,
      add: 'Add',
    },
    cart: {
      title: 'Your Order',
      empty: 'Your cart is empty.',
      total: 'Total',
      checkout: 'Checkout',
    },
    checkout: {
      title: 'Place Order',
      name: 'Name',
      namePlaceholder: 'Your name',
      phone: 'Phone',
      phonePlaceholder: 'Your phone number',
      time: 'Pickup Time',
      note: 'Special Requests',
      notePlaceholder: 'Allergies, preferences...',
      subtotal: 'Subtotal',
      tax: 'Tax (6.25%)',
      pay: 'Pay',
      successTitle: 'Order Placed!',
      successMsg: 'We\'ll have your order ready at the requested time.',
      done: 'Done',
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
      sub: '新鲜手工，到店自取。',
      cta: '立即点餐',
    },
    menu: {
      title: '我们的菜单',
      price: (p) => `$${p}`,
      add: '加入',
    },
    cart: {
      title: '我的订单',
      empty: '购物车是空的。',
      total: '合计',
      checkout: '去结账',
    },
    checkout: {
      title: '提交订单',
      name: '姓名',
      namePlaceholder: '你的姓名',
      phone: '电话',
      phonePlaceholder: '你的电话号码',
      time: '取餐时间',
      note: '备注',
      notePlaceholder: '过敏、特殊要求...',
      subtotal: '小计',
      tax: '税 (6.25%)',
      pay: '支付',
      successTitle: '订单已提交！',
      successMsg: '我们会在您指定时间备好餐。',
      done: '完成',
    },
    footer: {
      copy: '© 2025 NoodleFan 粉面王. 保留所有权利。',
    },
  },
}

export default strings
