const request = require("supertest");
const nock = require("nock");
const server = require("./server");
let token;

describe("Login", () => {
  it("should not authenticate user if user doesn't exist", (done) => {
    request(server)
      .post("/api/login")
      .send({ username: "abc", password: "123" })
      .expect(401)
      .end((err, res) => {
        if (err) return done(err);

        expect(res.body.token).not.toBeDefined();
        expect(res.body.error).toBeDefined();
        done();
      });
  });

  it("should not authenticate user if user exists but password isn't found", (done) => {
    request(server)
      .post("/api/login")
      .send({ username: "taylors", password: "123" })
      .expect(401)
      .end((err, res) => {
        if (err) return done(err);

        expect(res.body.token).not.toBeDefined();
        expect(res.body.error).toBeDefined();
        done();
      });
  });
});

describe("Get Items", () => {
  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  beforeEach((done) => {
    request(server)
      .post("/api/login")
      .send({ username: "taylors", password: "111" })
      .end((err, res) => {
        if (err) return done(err);

        token = res.body.token;
        done();
      });
  });

  it(`should return items after token verification`, (done) => {
    request(server)
      .get("/api/items")
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);

        expect(res.body.items).toBeDefined();
        done();
      });
  });
});
