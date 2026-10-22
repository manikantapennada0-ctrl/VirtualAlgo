c = open('static/style.css', encoding='utf-8').read()
print('Open {:', c.count('{'), 'Close }:', c.count('}'))
