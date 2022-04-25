
import { suite, test } from '@testdeck/mocha';
import { expect, assert, should } from 'chai';
import { System } from '../../src/api/index';

// @ts-ignore
@suite class SystemTests {

  // Test properties


  /**
   * Set up test suite
   */
  static before() {
  }

  // @ts-ignore
  @test 
  async 'Get build number'() {

    // Get the build number
    let buildNumber = System.getBuildNumber();

    // Assert build number
    expect(buildNumber).to.not.be.undefined;
    expect(buildNumber).to.match(/^(\d+\.)?(\d+\.)?(\d+\.)?(\d+)$/);
  }



}