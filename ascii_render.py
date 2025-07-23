from PIL import Image

img = Image.open("docs/screenshots/editor.png")
img = img.resize((80, 40))  # Resize for terminal
img = img.convert('L')      # Convert to grayscale

chars = "@%#*+=-:. "
pixels = img.getdata()
ascii_str = ''.join([chars[pixel // 25] for pixel in pixels])

for i in range(0, len(ascii_str), img.width):
    print(ascii_str[i:i+img.width])
