import { expect, it } from 'vitest'
import { cleanBody, linkParts, slugify } from '../../shared/messages.js'

it('turns only http and https addresses into links, leaving sentence punctuation as text', () => {
  expect(linkParts('See https://glitch.dev/a?b=1, then http://x.io.')).toEqual([
    { type: 'text', value: 'See ' },
    { type: 'link', value: 'https://glitch.dev/a?b=1', href: 'https://glitch.dev/a?b=1' },
    { type: 'text', value: ', then ' },
    { type: 'link', value: 'http://x.io', href: 'http://x.io/' },
    { type: 'text', value: '.' },
  ])
  expect(linkParts('javascript:alert(1) and ftp://files and <a href="https://x.io">')).toEqual([
    { type: 'text', value: 'javascript:alert(1) and ftp://files and <a href="' },
    { type: 'link', value: 'https://x.io', href: 'https://x.io/' },
    { type: 'text', value: '">' },
  ])
  expect(linkParts('')).toEqual([])
  expect(linkParts('no links here')).toEqual([{ type: 'text', value: 'no links here' }])
})

it('cleans a message body: line breaks and tabs stay, control characters go', () => {
  expect(cleanBody('  a\r\nb\tc\u0000\u001b  ')).toBe('a\nb\tc')
  expect(cleanBody(undefined)).toBe('')
})

it('makes slugs from names', () => {
  expect(slugify('Café com JS')).toBe('cafe-com-js')
  expect(slugify('  --Python   Brasil!!  ')).toBe('python-brasil')
  expect(slugify('x'.repeat(60))).toHaveLength(40)
})
