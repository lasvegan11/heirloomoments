export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Playfair Display', 'serif'],
        sans: ['Jost', 'sans-serif'],
      },
      colors: {
        cream: '#FAF6EF',
        'cream-deep': '#F3ECE0',
        espresso: '#2A2620',
        'espresso-soft': '#5A5248',
        gold: '#B08D57',
        'gold-light': '#C9A874',
        border: '#E5DBCB',
      }
    }
  },
  plugins: []
}
