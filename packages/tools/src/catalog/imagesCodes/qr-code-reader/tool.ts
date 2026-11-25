import { ToolDefinition, ToolResult } from '@devtoolora/core';
import * as imageFunctions from '@devtoolora/functions/image';
import { withToolErrorAsync } from '../../../adapters/errors';
import { fileBytesFromField } from '../../../adapters/files';
import { browserSafeCapabilities } from '../shared';

const pngDataUri = (base64: string): string => `data:image/png;base64,${base64}`;

export const qrCodeReaderTool: ToolDefinition = {
  id: 'qr-code-reader',
  keywords: ['qr scanner', 'decode qr', 'scan', 'qr code'],
  name: 'QR Code Reader',
  category: 'Images & Codes',
  description: 'Decode QR codes from uploaded images locally.',
  inputKind: 'none',
  outputKind: 'json',
  supportsSelection: false,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  resultActions: ['copy', 'scratch'],
  relatedToolIds: ['qr-code-generator', 'wifi-qr'],
  fields: [{ id: 'image', label: 'Image file', required: true, type: 'file', accept: 'image/*' }],
  // Generated with the qrcode package and decoded with jsQR: each image holds the labeled payload.
  samples: [
    {
      fields: {
        image: pngDataUri(
          'iVBORw0KGgoAAAANSUhEUgAAAGMAAABjCAAAAACqUOFJAAABF0lEQVR42u2Z2w4CMQhE9/9/Wt9MU2YGtq6JXPpg4lo4m0LLUK/X78c1jGEMYxhPMy40Pj+tE+BDa1WbsS8lerL5cq0KM6w9C4+2asuIZ/Awtgn2a0+GoK7eYR6fnyUJGbASuJ8P1KhsDCosTEayynGufbIx4PrCgOnq24GxbmDmyw0M2PZFGTYw1rtQw/jlKjJsAIKKjRnWZmwGTLS5oerAgHkM9ZwQc/65W4Vh1x16F9NCmroKQ7tggu+wP0/OcE9ApmBuaJ/kDKF3WUMOs7kDw++IAv3V+Z1lNka8P9enZBOGvvcR495ZUp3B7hadTrUfQySuaEprM1grxe76WYEpz2C7NyJ2v72zTMWY/52HMYxh/DHjDe/qYA5UrdiSAAAAAElFTkSuQmCC',
        ),
      },
      label: 'Website link',
    },
    {
      fields: {
        image: pngDataUri(
          'iVBORw0KGgoAAAANSUhEUgAAAHsAAAB7CAAAAABxrKCjAAABpklEQVR42u2auxKDMAwE+f+fToo0jH23UhySzOCjoADsFSPraR+P/11H2GGHHXbY32Ef6no9P38z3IeB5WxhD+xRJRP7PO8slpNYzh/2mTSPlwy5AoaxIE3YPF6MnMRqShN2X9/O0tjrhb3m1zh4SDu8zKduwIb4vXC/LHe4L9smlD4lamp6PUe+O/usp9klORdWZlruy7ClbciUdJbArQl+FbbLQSE3cngwy7Bd/JZqk6I48LxQujXwluxm30HMhdmtsL2wVZbjUvy+4a331/Zgv6VUNi33JGwZS8CFle0zqJ9b8Xs/NuSpoDZugMKQsCFUu4DxyeIIuyx9yz6aDOHQEg0bmvIgTTkEpgq77N1zfWWjhe9NhF1uPklH5ro58CrsZp7KW1YSWa6VsLkqgM6ai/FMDZt3ldzmhzM8t1PS6nnsxy5zVjje4f6BaomwG+eZSn1Dqvp2f20bdumhym0VOOS0eJZqAzZr2j0sV0zYa7VBWdZKo+rWwGHjuY0yonOXJ+z+CSTo70AnaD1P3YNdeiV3hsNR6TfC/vkVdthhhx32ddcT8eGmfm4MZ8sAAAAASUVORK5CYII=',
        ),
      },
      label: 'Wi-Fi network',
    },
    {
      fields: {
        image: pngDataUri(
          'iVBORw0KGgoAAAANSUhEUgAAAGMAAABjCAAAAACqUOFJAAABDklEQVR42u3ZSw6DMAwE0Nz/0u2uos7MhLSpVI/NAiFC8hCf2Ibx+P0y2mijjTZOGwMt16bX9nVD9PI24qV8N+BYope9MffX47JexY3gtQENPNnx8yhiMHV+7Zezg7chZj2xPhCjshk0sUDPMXugP8x9shksWrBWeBeLGOEFDkPAVpjVVTDg1YdnsAzG9kY4GsIwkLAqwthY9hTedh1lYbAEbm5lVejdeTe/IcaFd0vY9sbNIb7KqR0NkfuKY7Zzn4SGznf1flGjWhrrigjFVJag2BuiPoffehhfxBDffVgU2f5OXcCA0QXuaUPXD2ee3VSGqBZ02XnmH0seg+UiOqVjU6ex0f+d22ijjT82nu2cKkQv6hWSAAAAAElFTkSuQmCC',
        ),
      },
      label: 'Plain text',
    },
    {
      fields: {
        image: pngDataUri(
          'iVBORw0KGgoAAAANSUhEUgAAAGMAAABjCAAAAACqUOFJAAABEUlEQVR42u2Z2w6EIBBD+f+f3n0zhGk7rGKylOHBiDoew6VTsH3eL60YxShGMVYzGirDA/3JdUyiTBljU3ZXhuCrqqO8GX2bxhZnjBh1LAPe1VHFSGf7UQxIjW9frCUbMmAmSI8LctRuDGosQn/AbnjkfXZjwPZloxZegWBvxkwV3jqHEb0a0z4oAdDqGTNm5A9+x2mMPGuG0TxQ7/uSDRmp1WBCKZKKK2MmobKEwZTRnqF3MYQsnsbQBoUVlm4tGdrvxh6atL+WjJn9xKiJIg17M1hPiLenSyxjBluZ60l+c63myIhDU1Qf7e9aMNhs1+tSb4b4/yGcMfTB3gyxnyjE8bexa8Go/87FKEYx/pjxBU5uAXsF+zlrAAAAAElFTkSuQmCC',
        ),
      },
      label: 'Email address',
    },
    {
      fields: {
        image: pngDataUri(
          'iVBORw0KGgoAAAANSUhEUgAAAFcAAABXCAAAAABUo4awAAAA10lEQVR42u2Y2w6AMAhD9/8/rU8aY0t1XhJo2INZlnGWIIOysfwzRnOb21wv7mBjX8cJ7rThnt20reBJ0U4bLrU/TcROY65Yb649l55Ev2/vcWJulH8jX7/N6ym5YXEFs2/qfFbu0Zj6kXp2Ln6LcGncoD2eMaHPinCpDsOMgz/DjEuSSOz3ab1ehHtTlD/XqRW4d/IvKvhv8nom7mU9nmhjinNF/6aLkx9X51zd13lzo1ATAs6VSzwYixIPrn7f0eFlw71876O37nkfm5Lb79XNbW5zD2MFes8w94gBlRkAAAAASUVORK5CYII=',
        ),
      },
      label: 'Phone number',
    },
    {
      fields: {
        image: pngDataUri(
          'iVBORw0KGgoAAAANSUhEUgAAAHsAAAB7CAAAAABxrKCjAAABrUlEQVR42u2aUa7DMAgEc/9Ltx+VqtSwA07SVoo3H09VFDOWeGBYvD3+92xmm2222WZ/h71lz/v968e4fvd++ExZMzsaUm/i4hQzbAjsmx0N7b9mo+kHYM3skh0jJA0/tV2zj7HjBzEbQrIzezavjWs+twJnyQU5dQG2Or+P/b2mdrg1WxaUIX7S4zwFnK2R785Oc1P0VkqN20oXmp36GxyWxh7jobUwG1ylzvLBeupaiDqzVd8FnUDZSLAps8HosKGyTlX1k9mdGEs3wQVr3GW3ZlqSrdpa0NGUs0EJMptVG9X3sr6mUp7ZZW8AK7lyUjXTRF+yGFvlpmYLoUx1Y2w9NtSdHX93tGazS+GgFS1VF1H7e2F22kqxdpn+gGPJbNWJgabQyYOts9/sdjEEo6nyH8JsxebkBZKxOtrz8YnZ2IA1Y0ypz6254JLsKfmYhDM9lzV7ai5YHsk8R2zF2JLs8j5TRz5Tt6DO3qW6L7ucfJcj2OMzSbP1HTLoDSZUCbOrG0jg6VKAa/UlC7PLvFYe8CA9mD17nwlkNbi0J1Uks3/+mG222Wabfd3zBM6NdL6ViUBVAAAAAElFTkSuQmCC',
        ),
      },
      label: 'Contact card',
    },
  ],
  run: ({ fields }) => readQrCode(fields),
};

async function readQrCode(fields: Record<string, string>): Promise<ToolResult> {
  const source = fileBytesFromField(fields.image, 'Image file');
  const code = await withToolErrorAsync(() =>
    imageFunctions.readQrCode({ name: fields.imageName || 'image', ...source }),
  );

  return {
    text: JSON.stringify({ data: code.data, version: code.version }, null, 2),
    language: 'json',
  };
}
