import { partesUriS3 } from './cargar-dataset';

describe('partesUriS3', () => {
  it('separa bucket y prefijo', () => {
    expect(partesUriS3('s3://toqui-prod-capturas-1/dataset/abc123/')).toEqual({
      bucket: 'toqui-prod-capturas-1',
      prefijo: 'dataset/abc123/',
    });
    expect(partesUriS3('s3://bucket')).toEqual({ bucket: 'bucket', prefijo: '' });
  });

  it('rechaza lo que no es una URI de S3', () => {
    expect(partesUriS3('/tmp/dataset')).toBeNull();
    expect(partesUriS3('https://bucket.s3.amazonaws.com/x')).toBeNull();
  });
});
