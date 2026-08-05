import { describe, expect, it } from 'vitest'
import { cssDeclarationsToStyle } from './layoutStyles'

describe('layout style declarations', () => {
  it('converts editable CSS declarations into React inline styles', () => {
    expect(
      cssDeclarationsToStyle(
        'padding: 36px 42px; background-color: #ffffff; --accent-color: #5966d4;',
      ),
    ).toEqual({
      padding: '36px 42px',
      backgroundColor: '#ffffff',
      '--accent-color': '#5966d4',
    })
  })

  it('ignores malformed or empty declarations', () => {
    expect(cssDeclarationsToStyle('padding: ; invalid; color: #20263a;')).toEqual({
      color: '#20263a',
    })
  })
})
