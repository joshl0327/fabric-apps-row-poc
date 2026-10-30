   import { it, expect } from 'vitest';

   it('deliberately fails to prove CI blocks the merge', () => {
     expect(1).toBe(2);
   });