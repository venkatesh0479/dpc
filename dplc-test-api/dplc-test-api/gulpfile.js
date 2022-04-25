const gulp = require('gulp');
const chalk = require("chalk");
const tap = require('gulp-tap');
const zip = require('gulp-zip');
const inject = require('gulp-inject');
const indent = require("gulp-indent");
const cleanDir = require('gulp-clean');
const rename = require('gulp-rename');
const buildUtils = require('./build-utils.js');

// Parse the command line arguments
const args = buildUtils.parseArgs(process.argv);

// Load the properties
var properties = buildUtils.loadProperties("./build-properties.yml");
properties.build.number = args.buildNumber || buildUtils.generateBuildNumber(1, 0);
properties.build.numberEscaped = properties.build.number.replace(/\./g, "-");
properties.build.versionIncrement = args.versionIncrement || `patch`;
properties.aws.region = args.awsRegion || properties.aws.region;
properties.aws.profile = args.awsProfile || properties.aws.profile;
properties.aws.suffixName = args.suffixName || `local`;
properties.aws.changeSetName = `build-${properties.build.numberEscaped}`;
properties.aws.bucketBasePath = args.awsBucketBasePath || `build/${properties.solution.key}`;
properties.aws.bucketPath = `${properties.aws.bucketBasePath}/${properties.build.number}`;

// Display build number
console.log(chalk.green(`\nBuild number: ${properties.build.number}`));

/**
 * Show the build properties
 * @param done Callback on complete 
 */
function showProperties(done) {
    console.log();

    // Iterate properties
    buildUtils.forEachProperty(properties, (propertyName, propertyValue) => {
        console.log(chalk`${propertyName}: {cyan ${propertyValue}}`);
    });

    console.log();
    done();
}

/**
 * Clean out directory
 */
function clean() {
    return gulp.src(properties.build.outDir, {read: false, allowEmpty: true})
    .pipe(cleanDir());
}

/**
 * API
 */
async function buildApi() {
    await buildUtils.exec(`tsc`);
}

function buildApiSystemInfo() {
    return gulp.src(`${properties.build.srcDir}/api/system-info.template`)
    .pipe(buildUtils.replaceProperties(properties))
    .pipe(rename('system-info.json'))
    .pipe(gulp.dest(`${properties.build.outDir}/api`));
}

async function packSrc(){
    return gulp.src([`**/*.*`, '!**/node_modules/**', '!**/node_modules', '!**/out/**', '!**/out', 
    `!**/${properties.build.srcDir}/infra/**`, `!**/${properties.build.srcDir}/infra`, 
    `!**/${properties.build.srcDir}/pipeline/**`, `!**/${properties.build.srcDir}/pipeline`])
    .pipe(tap(function (file) {
        if (file.isDirectory()) {
            file.stat.mode = parseInt('40777', 8);
        }
    }))
    .pipe(zip(`${properties.solution.key}.zip`))
    .pipe(gulp.dest(`${properties.build.outDir}/package`));
}

async function packageApi() {
    return gulp.src(`${properties.build.outDir}/api/**/*`, { base: `${properties.build.outDir}/api/` })
        .pipe(tap(function (file) {
            if (file.isDirectory()) {
                file.stat.mode = parseInt('40777', 8);
            }
        }))
        .pipe(zip(`${properties.solution.key}.zip`))
        .pipe(gulp.dest(`${properties.build.outDir}/package`));
}

async function publishSrc(){
    await buildUtils.exec(`aws s3 cp \
        ${properties.build.outDir}/package \
        s3://${properties.aws.bucketName}/${properties.aws.bucketPath}/ \
        --recursive \
        --exclude "*param*" \
        --region ${properties.aws.region} \
        --profile ${properties.aws.profile}`);
}

async function publishApi() {

    await buildUtils.exec(`aws s3 cp \
        ${properties.build.outDir}/package \
        s3://${properties.aws.bucketName}/${properties.aws.bucketPath}/ \
        --recursive \
        --exclude "*param*" \
        --region ${properties.aws.region} \
        --profile ${properties.aws.profile}`);
}

/**
 * Infrastructure build tasks
 */

function buildInfraReplace() {
    return gulp.src(`${properties.build.srcDir}/infra/**/*.{json,yml}`)
    .pipe(buildUtils.replaceProperties(properties))
    .pipe(gulp.dest(`${properties.build.outDir}/tmp/infra`));
}

function buildInfraResoureIndent() {
    return gulp.src(`${properties.build.outDir}/tmp/infra/**/resources/**/*.{json,yml}`)
     .pipe(indent({ tabs:false, amount:2 }))
     .pipe(gulp.dest(`${properties.build.outDir}/tmp/infra`));
}

function buildInfraEnv () {
    return gulp.src(`${properties.build.outDir}/tmp/infra/env/**/*.json`)
    .pipe(gulp.dest(`${properties.build.outDir}/infra/env`));
}

function buildInfraInject() {
    return gulp.src(`${properties.build.outDir}/tmp/infra/stack.yml`)
    .pipe(inject(gulp.src([`${properties.build.outDir}/tmp/infra/resources/**/*.{json,yml}`]), {
      starttag: '<!-- inject:resources:{{ext}} -->',
      removeTags: true,
      transform: function (filePath, file) {
        return file.contents.toString('utf8')
      }
    }))
    .pipe(rename(`${properties.aws.infra.stackName}.yml`))
    .pipe(gulp.dest(`${properties.build.outDir}/infra`));
}

async function validateInfra() {
    await buildUtils.exec(`aws cloudformation validate-template \
        --template-body file://${properties.build.outDir}/infra/${properties.aws.infra.stackName}.yml \
        --profile ${properties.aws.profile}`, { verbose: true });
}

async function publishInfra() {
    await buildUtils.exec(`aws s3 cp \
        ${properties.build.outDir}/infra \
        s3://${properties.aws.bucketName}/${properties.aws.bucketPath}/ \
        --recursive \
        --exclude "*param*" \
        --profile ${properties.aws.profile}`);
}

async function deployInfra() {

    // Init stack exists flag
    var stackExists = true;

    try {
        await buildUtils.exec(`aws cloudformation describe-stacks \
            --stack-name ${properties.aws.infra.stackName}-${properties.aws.suffixName} \
            --region ${properties.aws.region} \
            --profile ${properties.aws.profile}`);   
    }
    catch(ex) {
        stackExists = false;
    }

    // Create or update stack
    if(stackExists) {
        await buildUtils.exec(`aws cloudformation update-stack \
                --stack-name ${properties.aws.infra.stackName}-${properties.aws.suffixName} \
                --cli-input-json file://${properties.build.outDir}/infra/env/${properties.env}/stack-param.json \
                --region ${properties.aws.region} \
                --profile ${properties.aws.profile}`, { verbose: true }); 
    }
    else {
        await buildUtils.exec(`aws cloudformation create-stack \
            --stack-name ${properties.aws.infra.stackName}-${properties.aws.suffixName} \
            --cli-input-json file://${properties.build.outDir}/infra/env/${properties.env}/stack-param.json \
            --region ${properties.aws.region} \
            --profile ${properties.aws.profile}`, { verbose: true }); 
    }    
}

/**
 * Pipeline build tasks
 */

 function buildPipelineReplace() {
    return gulp.src(`${properties.build.srcDir}/pipeline/**/*.{json,yml}`)
    .pipe(buildUtils.replaceProperties(properties))
    .pipe(gulp.dest(`${properties.build.outDir}/tmp/pipeline`));
}

function buildPipelineResoureIndent() {
    return gulp.src(`${properties.build.outDir}/tmp/pipeline/**/resources/**/*.{json,yml}`)
     .pipe(indent({ tabs:false, amount:2 }))
     .pipe(gulp.dest(`${properties.build.outDir}/tmp/pipeline`));
}

function buildPipelineEnv () {
    return gulp.src(`${properties.build.outDir}/tmp/pipeline/env/**/*.json`)
    .pipe(gulp.dest(`${properties.build.outDir}/pipeline/env`));
}

function buildPipelineInject() {
    return gulp.src(`${properties.build.outDir}/tmp/pipeline/stack.yml`)
    .pipe(inject(gulp.src([`${properties.build.outDir}/tmp/pipeline/resources/**/*.{json,yml}`]), {
      starttag: '<!-- inject:resources:{{ext}} -->',
      removeTags: true,
      transform: function (filePath, file) {
        return file.contents.toString('utf8')
      }
    }))
    .pipe(rename(`${properties.aws.pipeline.stackName}.yml`))
    .pipe(gulp.dest(`${properties.build.outDir}/pipeline`));
}
async function validatePipeline() {
    try {
        await buildUtils.exec(`aws cloudformation validate-template \
            --template-body file://${properties.build.outDir}/pipeline/${properties.aws.pipeline.stackName}.yml \
            --profile ${properties.aws.profile}`);
    }
    catch(ex) {
        console.log(chalk.red("Validation error"));
        console.log(ex.stderr);
    }
}

async function publishPipeline() {
    await buildUtils.exec(`aws s3 cp \
    ${properties.build.outDir}/pipeline \
    s3://${properties.aws.bucketName}/${properties.aws.bucketPath}/ \
    --recursive \
    --exclude "*param*" \
    --profile ${properties.aws.profile}`);
}

async function deployPipeline() {

    try {
        await buildUtils.exec(`aws cloudformation describe-stacks \
            --stack-name ${properties.aws.pipeline.stackName}-${properties.aws.pipeline.repositoryBranchName} \
            --region ${properties.aws.region} \
            --profile ${properties.aws.profile}`);   

        await buildUtils.exec(`aws cloudformation update-stack \
            --stack-name ${properties.aws.pipeline.stackName}-${properties.aws.pipeline.repositoryBranchName} \
            --cli-input-json file://${properties.build.outDir}/pipeline/env/${properties.aws.pipeline.repositoryBranchName}/stack-param.json \
            --region ${properties.aws.region} \
            --profile ${properties.aws.profile}`);  
    }
    catch(ex) {
        await buildUtils.exec(`aws cloudformation create-stack \
            --stack-name ${properties.aws.pipeline.stackName}-${properties.aws.pipeline.repositoryBranchName} \
            --cli-input-json file://${properties.build.outDir}/pipeline/env/${properties.aws.pipeline.repositoryBranchName}/stack-param.json \
            --region ${properties.aws.region} \
            --profile ${properties.aws.profile}`, { verbose: true });  
    }
}

// Export build tasks
exports.clean = gulp.series(clean);
exports.showProperties = gulp.series(showProperties);

// Sdk tasks
exports.buildApi = gulp.series(clean, buildApi, buildApiSystemInfo);
exports.packageApi = gulp.series(exports.buildApi, packageApi);
exports.publishApi = gulp.series(exports.packageApi, publishApi);
exports.packageSrc = gulp.series(exports.buildApi, packSrc);
exports.publishSrc = gulp.series(exports.packageSrc, publishSrc);
// Infra tasks
exports.buildInfra = gulp.series(clean, buildInfraReplace, buildInfraResoureIndent, gulp.parallel(buildInfraEnv, buildInfraInject));
exports.validateInfra = gulp.series(exports.buildInfra, validateInfra);
exports.publishInfra = gulp.series(exports.buildInfra, publishInfra);
exports.deployInfra = gulp.series(exports.publishInfra, deployInfra);

// Pipeline tasks
exports.buildPipelineReplace = gulp.series(clean, buildPipelineReplace)
exports.buildPipeline = gulp.series(clean, buildPipelineReplace, buildPipelineResoureIndent, gulp.parallel(buildPipelineEnv, buildPipelineInject));
exports.validatePipeline = gulp.series(exports.buildPipeline, validatePipeline);
exports.publishPipeline = gulp.series(exports.buildPipeline, publishPipeline);
exports.deployPipeline = gulp.series(exports.publishPipeline, deployPipeline);

// General tasks
exports.build = gulp.series(clean, gulp.parallel(buildApi, gulp.series(buildInfraReplace, buildInfraResoureIndent, gulp.parallel(buildInfraEnv, buildInfraInject))));
exports.package = gulp.series(exports.build, packageApi);
exports.publish = gulp.series(exports.package, gulp.parallel(publishApi, publishInfra));
exports.deploy = gulp.series(exports.publish, deployInfra);