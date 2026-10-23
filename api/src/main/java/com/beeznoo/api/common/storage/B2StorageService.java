package com.beeznoo.api.common.storage;

import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.net.URI;
import java.time.Duration;

/**
 * Backblaze B2 pela API compatível com S3. O bucket tem de ser privado: o B2 não usa ACL por objecto,
 * o acesso é controlado ao nível do bucket e só por URL pré-assinada.
 */
@Service
public class B2StorageService implements StorageService {

    private final S3Client s3;
    private final S3Presigner presigner;
    private final String bucket;

    public B2StorageService(StorageProperties props) {
        URI endpoint = URI.create(props.endpoint());
        Region region = Region.of(props.region());
        StaticCredentialsProvider credentials = StaticCredentialsProvider.create(
                AwsBasicCredentials.create(props.accessKey(), props.secretKey()));

        this.s3 = S3Client.builder()
                .endpointOverride(endpoint)
                .region(region)
                .credentialsProvider(credentials)
                .build();
        this.presigner = S3Presigner.builder()
                .endpointOverride(endpoint)
                .region(region)
                .credentialsProvider(credentials)
                .build();
        this.bucket = props.bucket();
    }

    @Override
    public String upload(String folder, String filename, byte[] content, String contentType) {
        String key = folder + "/" + filename;
        s3.putObject(PutObjectRequest.builder()
                        .bucket(bucket)
                        .key(key)
                        .contentType(contentType)
                        .contentLength((long) content.length)
                        .build(),
                RequestBody.fromBytes(content));
        return key;
    }

    @Override
    public String generateSignedUrl(String storageKey, Duration ttl) {
        return presigner.presignGetObject(GetObjectPresignRequest.builder()
                        .signatureDuration(ttl)
                        .getObjectRequest(GetObjectRequest.builder().bucket(bucket).key(storageKey).build())
                        .build())
                .url()
                .toString();
    }

    @Override
    public void delete(String storageKey) {
        s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(storageKey).build());
    }

    @PreDestroy
    void close() {
        presigner.close();
        s3.close();
    }
}
